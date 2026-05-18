import { createServerFn } from "@tanstack/react-start";

export type CoachingObservation = {
  title: string;
  detail: string;
  sentiment: "positive" | "warning" | "critical";
};

export type CoachingSummary = {
  observations: CoachingObservation[];
  generatedAt: string;
};

export type CoachingInput = {
  athleteName: string;
  athleteAge: number | null;
  peakSpeed: number;
  avgSpeed: number;
  peakAdvance: number;
  peakRetreat: number;
  readingCount: number;
  duration: number;
};

export type DrillPrescription = {
  name: string;
  addresses: string;
  instructions: string[];
  duration: string;
  target: string;
};

export type DrillsPlan = {
  drills: DrillPrescription[];
  generatedAt: string;
  completed: Record<string, string>; // drill name -> ISO date completed
};

export type DrillsInput = CoachingInput & {
  tagsSummary: string;
};

export type DrillKind = "solo" | "partner" | "footwork";
export type AthleteDrillPrescription = DrillPrescription & { priority: 1 | 2 | 3; kind: DrillKind };

export type AthleteDrillPlan = {
  drills: AthleteDrillPrescription[];
  generatedAt: string;
  sessionCountAtGeneration: number;
  completed: Record<string, { completedAt: string; drill: AthleteDrillPrescription }>;
};

export type AthleteDrillsInput = {
  athleteName: string;
  athleteAge: number | null;
  sessionCount: number;
  avgPeakSpeed: number;
  avgAdvanceSpeed: number;
  avgRetreatSpeed: number;
  avgSpeed: number;
  actionSuccessRates: string;
  allowedKinds?: DrillKind[];
  equipment?: string;
  focusArea?: string;
};

async function callAnthropic(prompt: string, maxTokens: number = 1500): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("Missing ANTHROPIC_API_KEY");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${text}`);
  }
  const json = (await res.json()) as { content: Array<{ type: string; text?: string }> };
  const text = json.content?.find((c) => c.type === "text")?.text ?? "";
  return stripFences(text);
}

function stripFences(s: string): string {
  return s
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .replace(/[\x00-\x1F\x7F]/g, (c) => (c === "\n" || c === "\t" ? c : ""))
    .trim();
}

function parseJsonLoose<T>(cleaned: string): T {
  const s = stripFences(cleaned);
  try {
    return JSON.parse(s) as T;
  } catch {
    const obj = s.match(/\{[\s\S]*\}/);
    if (obj) return JSON.parse(obj[0]) as T;
    const arr = s.match(/\[[\s\S]*\]/);
    if (arr) return JSON.parse(arr[0]) as T;
    throw new Error("Failed to parse JSON from model output");
  }
}

const DRILL_RETRY_PROMPT =
  "Return ONLY a JSON array with exactly 3 drills. Keep each field under 100 words. No markdown. Format: [{name, addresses, instructions: [max 4 steps], duration, target, type}]";

async function retryDrillsArray(): Promise<DrillPrescription[]> {
  const cleaned = await callAnthropic(DRILL_RETRY_PROMPT, 2000);
  const parsed = parseJsonLoose<unknown>(cleaned);
  const arr = Array.isArray(parsed)
    ? (parsed as DrillPrescription[])
    : ((parsed as { drills?: DrillPrescription[] }).drills ?? []);
  return arr.slice(0, 3).map((d) => ({
    name: String(d.name ?? "Drill"),
    addresses: String(d.addresses ?? ""),
    instructions: Array.isArray(d.instructions) ? d.instructions.map((s) => String(s)) : [],
    duration: String(d.duration ?? ""),
    target: String(d.target ?? ""),
  }));
}

export const generateCoachingSummary = createServerFn({ method: "POST" })
  .inputValidator((input: CoachingInput) => input)
  .handler(async ({ data }): Promise<CoachingSummary> => {
    const ageStr = data.athleteAge ? String(data.athleteAge) : "teenage";
    const prompt = `You are an expert fencing coach analyzing performance data for ${data.athleteName}, a ${ageStr} year old épée fencer. Session data: Peak Speed ${data.peakSpeed.toFixed(2)} m/s, Avg Speed ${data.avgSpeed.toFixed(2)} m/s, Peak Advance ${data.peakAdvance.toFixed(2)} m/s, Peak Retreat ${data.peakRetreat.toFixed(2)} m/s, Total readings ${data.readingCount}, Session duration ${data.duration.toFixed(1)} seconds. Elite junior benchmarks: Peak Speed 4-6 m/s, Avg Speed 1.2-2.0 m/s, Peak Advance 3.5-5.0 m/s, Peak Retreat 3.0-4.5 m/s. Provide exactly 3 coaching observations in plain language a teenage athlete and their parent can understand. Be specific, encouraging but honest. Format as JSON: {observations: [{title: string, detail: string, sentiment: 'positive'|'warning'|'critical'}]}. Respond with ONLY the JSON, no markdown fences or commentary.`;
    const cleaned = await callAnthropic(prompt);
    const parsed = parseJsonLoose<{ observations: CoachingObservation[] }>(cleaned);
    const observations = (parsed.observations ?? []).slice(0, 3).map((o) => ({
      title: String(o.title ?? ""),
      detail: String(o.detail ?? ""),
      sentiment:
        o.sentiment === "positive" || o.sentiment === "warning" || o.sentiment === "critical"
          ? o.sentiment
          : "positive",
    }));
    return { observations, generatedAt: new Date().toISOString() };
  });

export const generateDrills = createServerFn({ method: "POST" })
  .inputValidator((input: DrillsInput) => input)
  .handler(async ({ data }): Promise<DrillsPlan> => {
    const ageStr = data.athleteAge ? String(data.athleteAge) : "teenage";
    const prompt = `You are an expert fencing coach. Athlete: ${data.athleteName}, age ${ageStr}, épée fencer. Session performance: Peak Speed ${data.peakSpeed.toFixed(2)} m/s, Avg Speed ${data.avgSpeed.toFixed(2)} m/s, Peak Advance ${data.peakAdvance.toFixed(2)} m/s, Peak Retreat ${data.peakRetreat.toFixed(2)} m/s. Tagged actions this session: ${data.tagsSummary}. Elite junior benchmarks: Peak Advance 3.5-5.0 m/s, Peak Retreat 3.0-4.5 m/s, Avg Speed 1.2-2.0 m/s. Based on the weakest metrics compared to benchmarks, prescribe exactly 3 targeted drills. For each drill provide: name, the specific weakness it addresses, step by step instructions in plain language, duration or reps, and a measurable target speed or metric to hit before moving on. Format as JSON: {drills: [{name: string, addresses: string, instructions: string[], duration: string, target: string}]}. Respond with ONLY the JSON, no markdown fences or commentary.`;
    let drills: DrillPrescription[];
    try {
      const cleaned = await callAnthropic(prompt, 2000);
      const parsed = parseJsonLoose<{ drills: DrillPrescription[] }>(cleaned);
      drills = (parsed.drills ?? []).slice(0, 3).map((d) => ({
        name: String(d.name ?? "Drill"),
        addresses: String(d.addresses ?? ""),
        instructions: Array.isArray(d.instructions) ? d.instructions.map((s) => String(s)) : [],
        duration: String(d.duration ?? ""),
        target: String(d.target ?? ""),
      }));
    } catch (err) {
      console.warn("generateDrills initial parse failed, retrying:", err);
      try {
        drills = await retryDrillsArray();
      } catch (err2) {
        console.error("generateDrills retry failed:", err2);
        throw new Error("Drill generation failed — tap Regenerate to try again.");
      }
    }
    return { drills, generatedAt: new Date().toISOString(), completed: {} };
  });

export const generateAthleteDrillPlan = createServerFn({ method: "POST" })
  .inputValidator((input: AthleteDrillsInput) => input)
  .handler(async ({ data }): Promise<Omit<AthleteDrillPlan, "completed">> => {
    const ageStr = data.athleteAge ? String(data.athleteAge) : "teenage";
    const allKinds: DrillKind[] = ["solo", "partner", "footwork"];
    const allowed = (data.allowedKinds && data.allowedKinds.length ? data.allowedKinds : allKinds).filter((k, i, a) => a.indexOf(k) === i);
    const kindLabels: Record<DrillKind, string> = {
      solo: '"solo" (individual drill, no partner needed, can be done alone at home or in a gym, weapon optional)',
      partner: '"partner" (requires a training partner or coach)',
      footwork: '"footwork" (footwork-only, no weapon required)',
    };
    const mixRequirement = allowed.length === 1
      ? `MIX REQUIREMENT: ALL drills MUST be of kind ${kindLabels[allowed[0]]}. Do NOT prescribe any other kind.`
      : `CRITICAL MIX REQUIREMENT: only use these kinds and include at least one drill of EACH: ${allowed.map((k) => kindLabels[k]).join(", ")}. Do NOT prescribe any other kind.`;
    const equipmentLine = data.equipment && data.equipment.trim()
      ? `Equipment available to the athlete: ${data.equipment.trim()}. Prefer drills that make use of this equipment when relevant, and do not prescribe drills requiring equipment the athlete did not list.`
      : `Assume no special equipment beyond standard fencing gear and a phone for timing.`;
    const focusLine = data.focusArea && data.focusArea.trim()
      ? `Athlete-requested focus area: ${data.focusArea.trim()}. Bias the plan so that at least 2 of the prescribed drills directly target this focus, while still respecting the mix requirement above.`
      : "";
    const prompt = `You are an expert fencing coach. Athlete: ${data.athleteName}, age ${ageStr}, épée fencer. Aggregate performance across ${data.sessionCount} sessions: Average peak speed ${data.avgPeakSpeed.toFixed(2)} m/s, Average advance speed ${data.avgAdvanceSpeed.toFixed(2)} m/s, Average retreat speed ${data.avgRetreatSpeed.toFixed(2)} m/s, Average speed ${data.avgSpeed.toFixed(2)} m/s. Tagged action success rates: ${data.actionSuccessRates}. Elite junior benchmarks: Peak Speed 4-6 m/s, Avg Speed 1.2-2.0 m/s, Peak Advance 3.5-5.0 m/s, Peak Retreat 3.0-4.5 m/s. Based on the biggest gaps between current performance and benchmarks, and the action success rate data, prescribe between 3 and 5 targeted drills in priority order. ${mixRequirement} Mark each drill with a "kind" field set to exactly one of "solo", "partner", or "footwork". ${equipmentLine} ${focusLine} For each drill: name, what weakness it addresses, step by step instructions in plain language for a 14 year old, duration or reps, and a target the athlete can measure themselves using only a phone stopwatch or a training partner. Format as JSON: {drills: [{name: string, addresses: string, instructions: string[], duration: string, target: string, priority: 1|2|3, kind: "solo"|"partner"|"footwork"}]}. Respond with ONLY the JSON, no markdown fences or commentary.`;
    const cleaned = await callAnthropic(prompt);
    const parsed = parseJsonLoose<{ drills: AthleteDrillPrescription[] }>(cleaned);
    const drills = (parsed.drills ?? []).slice(0, 5).map((d, i) => {
      const pRaw = Number(d.priority);
      const priority = (pRaw === 1 || pRaw === 2 || pRaw === 3 ? pRaw : Math.min(3, i + 1)) as 1 | 2 | 3;
      const kRaw = String((d as { kind?: string }).kind ?? "").toLowerCase();
      const kind: DrillKind = kRaw === "partner" ? "partner" : kRaw === "footwork" ? "footwork" : "solo";
      return {
        name: String(d.name ?? `Drill ${i + 1}`),
        addresses: String(d.addresses ?? ""),
        instructions: Array.isArray(d.instructions) ? d.instructions.map((s) => String(s)) : [],
        duration: String(d.duration ?? ""),
        target: String(d.target ?? ""),
        priority,
        kind,
      };
    });
    drills.sort((a, b) => a.priority - b.priority);
    return {
      drills,
      generatedAt: new Date().toISOString(),
      sessionCountAtGeneration: data.sessionCount,
    };
  });
