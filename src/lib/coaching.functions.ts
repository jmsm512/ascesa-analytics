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

async function callAnthropic(prompt: string): Promise<string> {
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
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${text}`);
  }
  const json = (await res.json()) as { content: Array<{ type: string; text?: string }> };
  const text = json.content?.find((c) => c.type === "text")?.text ?? "";
  return text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
}

function parseJsonLoose<T>(cleaned: string): T {
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Failed to parse JSON from model output");
    return JSON.parse(match[0]) as T;
  }
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
    const cleaned = await callAnthropic(prompt);
    const parsed = parseJsonLoose<{ drills: DrillPrescription[] }>(cleaned);
    const drills = (parsed.drills ?? []).slice(0, 3).map((d) => ({
      name: String(d.name ?? "Drill"),
      addresses: String(d.addresses ?? ""),
      instructions: Array.isArray(d.instructions) ? d.instructions.map((s) => String(s)) : [],
      duration: String(d.duration ?? ""),
      target: String(d.target ?? ""),
    }));
    return { drills, generatedAt: new Date().toISOString(), completed: {} };
  });
