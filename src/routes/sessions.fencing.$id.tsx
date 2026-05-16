import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell } from "@/components/AppShell";
import { getAthlete, getFencingSession } from "@/lib/data";
import { generateCoachingSummary, type CoachingSummary } from "@/lib/coaching.functions";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  ReferenceLine,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { ArrowLeft, Check, X, Upload, RotateCcw, Download, Trash2 } from "lucide-react";
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { msToFps } from "@/lib/units";
import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";

export const Route = createFileRoute("/sessions/fencing/$id")({
  component: FencingSession,
  validateSearch: (s: Record<string, unknown>) => ({
    tab: s.tab === "Video" || s.tab === "Actions" || s.tab === "Overview" ? (s.tab as "Video" | "Actions" | "Overview") : undefined,
  }),
});

const TABS = ["Overview", "Actions", "Video"] as const;

function FencingSession() {
  const { id } = Route.useParams();
  const search = Route.useSearch();
  const [tab, setTab] = useState<(typeof TABS)[number]>(search.tab ?? "Overview");
  const q = useQuery({ queryKey: ["fencing-session", id], queryFn: () => getFencingSession(id) });
  const session = q.data?.session;
  const fs = q.data?.fs;
  const actions = q.data?.actions ?? [];
  const sensors = q.data?.sensors ?? [];

  return (
    <RequireAuth>
      <AppShell>
        <Link to="/" className="inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </Link>

        {session && fs && (
          <div className="surface mt-4 p-6" style={{ borderLeft: "4px solid var(--fencing)" }}>
            <div className="metric-label mb-2">Fencing Bout</div>
            <h1 className="text-2xl font-bold tracking-tight">{format(new Date(session.session_date), "EEEE, MMM d")}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-[var(--text-secondary)]">
              <span>Weapon: <span className="text-[var(--text-primary)]">{fs.weapon}</span></span>
              <span>Opponent: <span className="text-[var(--text-primary)]">{fs.opponent}</span></span>
              <span>Score:{" "}
                <span className={`font-semibold ${fs.result === "win" ? "text-[var(--data-positive)]" : "text-[var(--data-negative)]"}`}>
                  {fs.result?.toUpperCase()} {fs.touches_scored}-{fs.touches_received}
                </span>
              </span>
            </div>
          </div>
        )}

        <div className="mt-6 flex gap-1 border-b border-[var(--border-subtle)]">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`relative px-4 py-2.5 text-sm font-medium transition-colors ${
                tab === t ? "text-[var(--accent)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              {t}
              {tab === t && <span className="absolute inset-x-3 -bottom-px h-0.5 bg-[var(--accent)]" />}
            </button>
          ))}
        </div>

        {tab === "Overview" && fs && (
          <>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <StatCard label="Touches scored" value={String(fs.touches_scored)} accent="positive" />
              <StatCard label="Touches received" value={String(fs.touches_received)} accent="negative" />
              <StatCard label="Result" value={fs.result?.toUpperCase() ?? "—"} accent={fs.result === "win" ? "positive" : "negative"} />
            </div>

            {sensors.length > 0 && (
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <SensorChart title="Attack speed (ft/s)" data={sensors.map((s: any) => ({ ...s, attack_speed_fps: msToFps(Number(s.attack_speed_ms)) }))} dataKey="attack_speed_fps" />
                <SensorChart title="Footwork cadence" data={sensors} dataKey="footwork_cadence" />
              </div>
            )}
          </>
        )}

        {tab === "Actions" && (
          <div className="mt-6 surface overflow-hidden">
            {actions.length === 0 && <div className="px-5 py-10 text-center text-sm text-[var(--text-secondary)]">No actions logged.</div>}
            <ul className="divide-y divide-[var(--border-subtle)]">
              {actions.map((a: any) => (
                <li key={a.id} className="row-hover flex items-center gap-4 px-5 py-3">
                  <div className="w-12 text-xs text-[var(--text-secondary)] tabular-nums">
                    {Math.floor(a.timestamp_seconds / 60)}:{String(Math.floor(a.timestamp_seconds % 60)).padStart(2, "0")}
                  </div>
                  <span className="rounded-full bg-[var(--bg-elevated)] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                    {a.action_type}
                  </span>
                  {a.successful ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--accent-glow)] px-2 py-0.5 text-[10px] font-medium text-[var(--accent)]">
                      <Check className="h-3 w-3" /> Success
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--data-negative)]/15 px-2 py-0.5 text-[10px] font-medium text-[var(--data-negative)]">
                      <X className="h-3 w-3" /> Missed
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {tab === "Video" && (
          <VideoSpeedAnalyzer
            sessionId={id}
            fencingSessionId={fs?.id ?? null}
            athleteId={session?.athlete_id ?? null}
            existingVideoUrl={q.data?.videoUrl ?? null}
            existingAnalysis={q.data?.speedAnalysis ?? null}
            onSaved={() => q.refetch()}
          />
        )}
      </AppShell>
    </RequireAuth>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: "positive" | "negative" }) {
  const color = accent === "positive" ? "var(--data-positive)" : accent === "negative" ? "var(--data-negative)" : undefined;
  return (
    <div className="surface p-5" style={color ? { borderTop: `2px solid ${color}` } : undefined}>
      <div className="metric-label">{label}</div>
      <div className="metric-num-md mt-2" style={color ? { color } : undefined}>{value}</div>
    </div>
  );
}

function getBenchmarkColor(value: number, eliteMin: number): string {
  if (value >= eliteMin) return "var(--data-positive)";
  if (value >= eliteMin * 0.8) return "var(--data-warning)";
  return "var(--data-negative)";
}

function BenchmarkStatCard({
  label,
  value,
  numericValue,
  benchmarkText,
  eliteMin,
}: {
  label: string;
  value: string;
  numericValue: number;
  benchmarkText: string;
  eliteMin: number;
}) {
  const color = getBenchmarkColor(numericValue, eliteMin);
  return (
    <TooltipProvider delayDuration={100}>
      <UITooltip>
        <TooltipTrigger asChild>
          <div className="surface p-5 cursor-help" style={{ borderTop: `2px solid ${color}` }}>
            <div className="metric-label">{label}</div>
            <div className="metric-num-md mt-2" style={{ color }}>{value}</div>
          </div>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          sideOffset={8}
          className="max-w-[240px] bg-[var(--bg-elevated)] border border-[var(--border-default)] text-[var(--text-primary)] p-3 rounded-lg shadow-lg"
        >
          <p className="text-xs leading-relaxed">{benchmarkText}</p>
        </TooltipContent>
      </UITooltip>
    </TooltipProvider>
  );
}

function SensorChart({ title, data, dataKey }: { title: string; data: any[]; dataKey: string }) {
  return (
    <div className="surface p-5">
      <div className="metric-label mb-3">{title}</div>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data.map((d) => ({ ...d, rep: `R${d.rep_number}` }))}>
            <CartesianGrid stroke="var(--border-subtle)" vertical={false} />
            <XAxis dataKey="rep" tick={{ fill: "var(--text-secondary)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "var(--text-secondary)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)", borderRadius: 8, fontSize: 12 }} />
            <Line type="monotone" dataKey={dataKey} stroke="var(--fencing)" strokeWidth={2.5} dot={{ r: 4, fill: "var(--fencing)" }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ============= Video Speed Analyzer =============

type Pt = { x: number; y: number };
type Frame = { time: number; nx: number; ny: number; detected: boolean };
type Reading = { time: number; speed: number; direction: "advance" | "retreat" };
type ActionType = "Attack" | "Lunge" | "Parry" | "Riposte" | "Advance" | "Retreat" | "Touch";
type ActionTag = { id: string; time: number; action: ActionType; success: boolean };

const ACTION_COLORS: Record<ActionType, string> = {
  Attack: "#ef4444",
  Lunge: "#f97316",
  Parry: "#3b82f6",
  Riposte: "#06b6d4",
  Advance: "#22c55e",
  Retreat: "#ec4899",
  Touch: "#eab308",
};
const ACTION_TYPES: ActionType[] = ["Attack", "Lunge", "Parry", "Riposte", "Advance", "Retreat", "Touch"];

const ACTION_BENCHMARKS: Record<string, { metric: "peak" | "avg"; eliteMin: number; eliteMax: number; label: string }> = {
  Lunge: { metric: "peak", eliteMin: 3.5, eliteMax: 5.0, label: "Elite junior: 3.5–5.0 m/s" },
  Attack: { metric: "peak", eliteMin: 3.0, eliteMax: 4.5, label: "Elite junior: 3.0–4.5 m/s" },
  Advance: { metric: "avg", eliteMin: 1.5, eliteMax: 2.5, label: "Elite junior: 1.5–2.5 m/s" },
  Retreat: { metric: "peak", eliteMin: 3.0, eliteMax: 4.5, label: "Elite junior: 3.0–4.5 m/s" },
};

type SavedAnalysis = {
  readings: Reading[];
  duration: number;
  points: Pt[];
  savedAt: string;
  tags?: ActionTag[];
  coaching?: CoachingSummary;
};

function VideoSpeedAnalyzer({
  sessionId,
  fencingSessionId,
  athleteId,
  existingVideoUrl,
  existingAnalysis,
  onSaved,
}: {
  sessionId: string;
  fencingSessionId: string | null;
  athleteId: string | null;
  existingVideoUrl: string | null;
  existingAnalysis: SavedAnalysis | null;
  onSaved?: () => void;
}) {
  type Stage = "upload" | "extracting" | "calibrate" | "analyzing" | "results";
  const initialStage: Stage = existingAnalysis && existingVideoUrl ? "results" : "upload";
  const [stage, setStage] = useState<Stage>(initialStage);
  const [dataUrl, setDataUrl] = useState<string | null>(existingVideoUrl);
  const [firstFrame, setFirstFrame] = useState<string | null>(null);
  const [duration, setDuration] = useState(existingAnalysis?.duration ?? 0);
  const [points, setPoints] = useState<Pt[]>(existingAnalysis?.points ?? []);
  const [progress, setProgress] = useState({ cur: 0, total: 0 });
  const [readings, setReadings] = useState<Reading[]>(existingAnalysis?.readings ?? []);
  const [tags, setTags] = useState<ActionTag[]>(existingAnalysis?.tags ?? []);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [coaching, setCoaching] = useState<CoachingSummary | null>(existingAnalysis?.coaching ?? null);
  const [coachingLoading, setCoachingLoading] = useState(false);
  const [coachingError, setCoachingError] = useState<string | null>(null);
  const generateCoaching = useServerFn(generateCoachingSummary);
  const athleteQuery = useQuery({
    queryKey: ["athlete", athleteId],
    queryFn: () => (athleteId ? getAthlete(athleteId) : Promise.resolve(null)),
    enabled: !!athleteId,
  });
  const imgRef = useRef<HTMLImageElement>(null);
  const playbackRef = useRef<HTMLVideoElement>(null);

  async function persistVideo(file: File): Promise<string | null> {
    try {
      const { data: u } = await supabase.auth.getUser();
      const userId = u.user?.id;
      if (!userId) return null;
      const ext = (file.name.split(".").pop() || "mp4").toLowerCase();
      const path = `${userId}/${sessionId}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("videos")
        .upload(path, file, { contentType: file.type || "video/mp4", upsert: true });
      if (upErr) {
        console.error("video upload failed", upErr);
        return null;
      }
      if (fencingSessionId) {
        const { error: updErr } = await supabase
          .from("fencing_sessions")
          .update({ video_url: path } as any)
          .eq("id", fencingSessionId);
        if (updErr) console.error("fencing_sessions video_url update failed", updErr);
      }
      return path;
    } catch (e) {
      console.error("persistVideo error", e);
      return null;
    }
  }

  async function persistAnalysis(out: Reading[], pts: Pt[], dur: number, tagList: ActionTag[] = tags) {
    if (!fencingSessionId) return;
    const payload: SavedAnalysis = {
      readings: out,
      duration: dur,
      points: pts,
      savedAt: new Date().toISOString(),
      tags: tagList,
      coaching: coaching ?? undefined,
    };
    await supabase.from("fencing_sessions").update({ speed_analysis: payload } as any).eq("id", fencingSessionId);
    onSaved?.();
  }

  async function persistTags(next: ActionTag[]) {
    if (!fencingSessionId) return;
    const payload: SavedAnalysis = {
      readings,
      duration,
      points,
      savedAt: new Date().toISOString(),
      tags: next,
      coaching: coaching ?? undefined,
    };
    await supabase.from("fencing_sessions").update({ speed_analysis: payload } as any).eq("id", fencingSessionId);
  }

  async function persistCoaching(c: CoachingSummary) {
    if (!fencingSessionId) return;
    const payload: SavedAnalysis = {
      readings,
      duration,
      points,
      savedAt: new Date().toISOString(),
      tags,
      coaching: c,
    };
    await supabase.from("fencing_sessions").update({ speed_analysis: payload } as any).eq("id", fencingSessionId);
  }

  function speedAt(t: number): Reading | null {
    if (!readings.length) return null;
    let best = readings[0];
    let bestDiff = Math.abs(best.time - t);
    for (const r of readings) {
      const d = Math.abs(r.time - t);
      if (d < bestDiff) { best = r; bestDiff = d; }
    }
    return best;
  }

  const [pendingTag, setPendingTag] = useState<{ action: ActionType; time: number } | null>(null);

  function startTag(action: ActionType) {
    const t = playbackRef.current?.currentTime ?? currentTime;
    setPendingTag({ action, time: t });
  }

  function confirmTag(success: boolean) {
    if (!pendingTag) return;
    const next = [
      ...tags,
      { id: crypto.randomUUID(), time: pendingTag.time, action: pendingTag.action, success },
    ].sort((a, b) => a.time - b.time);
    setTags(next);
    setPendingTag(null);
    void persistTags(next);
  }

  function cancelPending() {
    setPendingTag(null);
  }

  function removeTag(id: string) {
    const next = tags.filter((t) => t.id !== id);
    setTags(next);
    void persistTags(next);
  }

  // Auto-generate coaching summary once readings + athlete are ready
  useEffect(() => {
    if (stage !== "results") return;
    if (coaching || coachingLoading) return;
    if (!readings.length) return;
    if (!athleteQuery.data) return;
    const athlete = athleteQuery.data;
    const peak = readings.reduce((m, r) => Math.max(m, r.speed), 0);
    const avg = readings.reduce((s, r) => s + r.speed, 0) / readings.length;
    const peakAdv = readings.filter((r) => r.direction === "advance").reduce((m, r) => Math.max(m, r.speed), 0);
    const peakRet = readings.filter((r) => r.direction === "retreat").reduce((m, r) => Math.max(m, r.speed), 0);
    setCoachingLoading(true);
    setCoachingError(null);
    generateCoaching({
      data: {
        athleteName: athlete.name,
        athleteAge: athlete.age,
        peakSpeed: peak,
        avgSpeed: avg,
        peakAdvance: peakAdv,
        peakRetreat: peakRet,
        readingCount: readings.length,
        duration,
      },
    })
      .then((c) => {
        setCoaching(c);
        void persistCoaching(c);
      })
      .catch((e: any) => setCoachingError(e?.message ?? "Failed to generate coaching summary"))
      .finally(() => setCoachingLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, readings, athleteQuery.data]);

  function onFile(file: File) {
    setError(null);
    setStage("extracting");
    setPendingFile(file);
    const reader = new FileReader();
    reader.onload = async () => {
      const url = reader.result as string;
      setDataUrl(url);
      try {
        const { frame, dur } = await extractFirstFrame(url);
        setFirstFrame(frame);
        setDuration(dur);
        setStage("calibrate");
      } catch (e: any) {
        setError(e?.message ?? "Failed to extract frame");
        setStage("upload");
      }
    };
    reader.onerror = () => {
      setError("Failed to read file");
      setStage("upload");
    };
    reader.readAsDataURL(file);
  }

  function extractFirstFrame(url: string): Promise<{ frame: string; dur: number }> {
    return new Promise((resolve, reject) => {
      const v = document.createElement("video");
      v.preload = "auto";
      v.muted = true;
      v.playsInline = true;
      v.crossOrigin = "anonymous";
      v.src = url;
      v.addEventListener("loadeddata", () => {
        v.currentTime = 0.05;
      });
      v.addEventListener("seeked", () => {
        const c = document.createElement("canvas");
        c.width = v.videoWidth;
        c.height = v.videoHeight;
        const ctx = c.getContext("2d");
        if (!ctx) return reject(new Error("Canvas 2D unavailable"));
        ctx.drawImage(v, 0, 0);
        resolve({ frame: c.toDataURL("image/jpeg", 0.9), dur: v.duration });
      }, { once: true });
      v.addEventListener("error", () => reject(new Error("Video load error")));
    });
  }

  function onImgClick(e: React.MouseEvent<HTMLImageElement>) {
    if (points.length >= 2) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setPoints([...points, { x, y }]);
  }

  async function runAnalysis() {
    if (!dataUrl || points.length < 2) return;
    setStage("analyzing");
    setError(null);
    try {
      const v = document.createElement("video");
      v.muted = true;
      v.playsInline = true;
      v.src = dataUrl;
      await new Promise<void>((res, rej) => {
        v.addEventListener("loadeddata", () => res(), { once: true });
        v.addEventListener("error", () => rej(new Error("Video error")), { once: true });
      });
      const c = document.createElement("canvas");
      c.width = v.videoWidth;
      c.height = v.videoHeight;
      const ctx = c.getContext("2d")!;

      const fileset = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm",
      );
      const poseLandmarker = await PoseLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numPoses: 1,
      });

      const step = 0.3;
      const times: number[] = [];
      for (let t = 0; t < v.duration; t += step) times.push(t);
      setProgress({ cur: 0, total: times.length });

      const frames: Frame[] = [];
      for (let i = 0; i < times.length; i++) {
        const t = times[i];
        await new Promise<void>((res) => {
          v.addEventListener("seeked", () => res(), { once: true });
          v.currentTime = t;
        });
        ctx.drawImage(v, 0, 0);
        try {
          const result = poseLandmarker.detectForVideo(c, Math.round(t * 1000));
          const lm = result.landmarks?.[0];
          if (lm && lm[23] && lm[24]) {
            const nx = (lm[23].x + lm[24].x) / 2;
            const ny = (lm[23].y + lm[24].y) / 2;
            frames.push({ time: t, nx, ny, detected: true });
          } else {
            frames.push({ time: t, nx: 0, ny: 0, detected: false });
          }
        } catch {
          frames.push({ time: t, nx: 0, ny: 0, detected: false });
        }
        setProgress({ cur: i + 1, total: times.length });
      }

      poseLandmarker.close();

      // Speed calc — use canvas pixel space
      const W = v.videoWidth, H = v.videoHeight;
      const p0 = { x: points[0].x * W, y: points[0].y * H };
      const p1 = { x: points[1].x * W, y: points[1].y * H };
      const axis = { x: p1.x - p0.x, y: p1.y - p0.y };
      const axisLen = Math.hypot(axis.x, axis.y);
      const ux = axis.x / axisLen;
      const uy = axis.y / axisLen;
      const mPerPx = 14 / axisLen;

      const out: Reading[] = [];
      const detected = frames.filter((f) => f.detected);
      for (let i = 1; i < detected.length; i++) {
        const a = detected[i - 1];
        const b = detected[i];
        const dx = (b.nx - a.nx) * W;
        const dy = (b.ny - a.ny) * H;
        const proj = dx * ux + dy * uy;
        const dt = b.time - a.time;
        if (dt <= 0) continue;
        const speed = Math.abs(proj * mPerPx) / dt;
        if (speed < 0.05 || speed > 10) continue;
        out.push({
          time: b.time,
          speed,
          direction: proj >= 0 ? "advance" : "retreat",
        });
      }
      setReadings(out);
      setStage("results");
      setSaving(true);
      try {
        if (pendingFile) await persistVideo(pendingFile);
        await persistAnalysis(out, points, v.duration);
      } finally {
        setSaving(false);
      }
    } catch (e: any) {
      setError(e?.message ?? "Analysis failed");
      setStage("calibrate");
    }
  }

  function reset() {
    setStage("upload");
    setDataUrl(null);
    setFirstFrame(null);
    setDuration(0);
    setPoints([]);
    setReadings([]);
    setTags([]);
    setProgress({ cur: 0, total: 0 });
    setError(null);
    setCoaching(null);
    setCoachingError(null);
  }

  function downloadCsv() {
    const lines = ["time_s,speed_ms,direction"];
    for (const r of readings) lines.push(`${r.time.toFixed(3)},${r.speed.toFixed(4)},${r.direction}`);
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "speed-readings.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const peak = readings.reduce((m, r) => Math.max(m, r.speed), 0);
  const avg = readings.length ? readings.reduce((s, r) => s + r.speed, 0) / readings.length : 0;
  const peakAdv = readings.filter((r) => r.direction === "advance").reduce((m, r) => Math.max(m, r.speed), 0);
  const peakRet = readings.filter((r) => r.direction === "retreat").reduce((m, r) => Math.max(m, r.speed), 0);

  return (
    <div className="mt-6 space-y-6">
      {error && (
        <div className="surface p-4 text-sm text-[var(--data-negative)]">{error}</div>
      )}

      {stage === "upload" && (
        <label
          className="surface flex cursor-pointer flex-col items-center justify-center gap-3 p-16 text-center transition-colors hover:border-[var(--accent)]"
          style={{ borderWidth: 2, borderStyle: "dashed" }}
        >
          <Upload className="h-8 w-8 text-[var(--text-secondary)]" />
          <div className="text-sm font-medium">Click to upload a fencing bout video</div>
          <div className="text-xs text-[var(--text-secondary)]">MP4, MOV, WebM — analysed entirely in your browser</div>
          <input
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
          />
        </label>
      )}

      {stage === "extracting" && (
        <div className="surface grid place-items-center p-16 text-sm text-[var(--text-secondary)]">
          Extracting first frame…
        </div>
      )}

      {stage === "calibrate" && firstFrame && (
        <div className="surface p-5">
          <div className="metric-label mb-2">Calibrate the piste</div>
          <p className="mb-4 text-xs text-[var(--text-secondary)]">
            Click the <span style={{ color: "var(--accent)" }}>0m end</span> of the piste, then the{" "}
            <span style={{ color: "var(--fencing)" }}>14m end</span>. Duration: {duration.toFixed(1)}s.
          </p>
          <div style={{ position: "relative", display: "inline-block", maxWidth: "100%" }}>
            <img
              ref={imgRef}
              src={firstFrame}
              alt="First frame"
              onClick={onImgClick}
              style={{ maxWidth: "100%", display: "block", cursor: points.length < 2 ? "crosshair" : "default" }}
            />
            {points.map((p, i) => (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: `${p.x * 100}%`,
                  top: `${p.y * 100}%`,
                  width: 14,
                  height: 14,
                  borderRadius: "50%",
                  background: i === 0 ? "var(--accent)" : "var(--fencing)",
                  border: "2px solid white",
                  transform: "translate(-50%, -50%)",
                  pointerEvents: "none",
                  boxShadow: "0 0 10px rgba(0,0,0,0.5)",
                }}
              />
            ))}
            {points.length === 2 && (
              <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
                <line
                  x1={`${points[0].x * 100}%`}
                  y1={`${points[0].y * 100}%`}
                  x2={`${points[1].x * 100}%`}
                  y2={`${points[1].y * 100}%`}
                  stroke="var(--accent)"
                  strokeWidth={2}
                  strokeDasharray="6 6"
                />
              </svg>
            )}
          </div>
          <div className="mt-4 flex gap-3">
            <button
              onClick={() => setPoints([])}
              className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-default)] px-3 py-1.5 text-xs hover:bg-[var(--bg-elevated)]"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Reset
            </button>
            {points.length === 2 && (
              <button
                onClick={runAnalysis}
                className="rounded-md bg-[var(--accent)] px-4 py-1.5 text-xs font-semibold text-black hover:opacity-90"
              >
                Confirm — Analyze Video
              </button>
            )}
          </div>
        </div>
      )}

      {stage === "analyzing" && (
        <div className="surface p-8">
          <div className="metric-label mb-3">
            Analyzing frame {progress.cur} of {progress.total}
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--bg-elevated)]">
            <div
              className="h-full bg-[var(--accent)] transition-all"
              style={{ width: `${progress.total ? (progress.cur / progress.total) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {stage === "results" && (
        <>
          {saving && (
            <div className="surface flex items-center gap-3 p-3 text-xs text-[var(--text-secondary)]">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-[var(--accent)]" />
              Saving analysis…
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-4">
            <BenchmarkStatCard label="Peak speed (m/s)" value={peak.toFixed(2)} numericValue={peak} benchmarkText="Elite junior fencers: 4–6 m/s. Olympic level: 6–8 m/s" eliteMin={4} />
            <BenchmarkStatCard label="Avg speed (m/s)" value={avg.toFixed(2)} numericValue={avg} benchmarkText="Higher average means more aggressive pressure footwork. Elite avg: 1.2–2.0 m/s" eliteMin={1.2} />
            <BenchmarkStatCard label="Peak advance (m/s)" value={peakAdv.toFixed(2)} numericValue={peakAdv} benchmarkText="Explosive advance drives attacks. Elite junior: 3.5–5.0 m/s" eliteMin={3.5} />
            <BenchmarkStatCard label="Peak retreat (m/s)" value={peakRet.toFixed(2)} numericValue={peakRet} benchmarkText="Fast retreat indicates good defensive instincts. Elite junior: 3.0–4.5 m/s" eliteMin={3.0} />
          </div>

          <CoachingCards coaching={coaching} loading={coachingLoading} error={coachingError} />

          {dataUrl && (
            <div className="surface overflow-hidden rounded-lg p-3">
              <video
                ref={playbackRef}
                src={dataUrl}
                controls
                playsInline
                onTimeUpdate={(e) => setCurrentTime((e.target as HTMLVideoElement).currentTime)}
                onSeeked={(e) => setCurrentTime((e.target as HTMLVideoElement).currentTime)}
                className="w-full rounded-md bg-black"
                style={{ maxHeight: 480 }}
              />
            </div>
          )}

          <div className="surface p-4">
            <div className="metric-label mb-3">Tag action at {currentTime.toFixed(2)}s</div>
            <div className="flex flex-wrap gap-2">
              {ACTION_TYPES.map((a) => (
                <button
                  key={a}
                  onClick={() => startTag(a)}
                  disabled={!!pendingTag}
                  className="rounded-md px-3 py-1.5 text-xs font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-40"
                  style={{ background: ACTION_COLORS[a] }}
                >
                  {a}
                </button>
              ))}
            </div>
            {pendingTag && (
              <div className="mt-3 flex flex-wrap items-center gap-3 rounded-md border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 py-2">
                <span className="text-xs text-[var(--text-secondary)]">
                  <span
                    className="mr-2 rounded-full px-2 py-0.5 text-[10px] font-semibold text-black"
                    style={{ background: ACTION_COLORS[pendingTag.action] }}
                  >
                    {pendingTag.action}
                  </span>
                  at {pendingTag.time.toFixed(2)}s — Successful?
                </span>
                <div className="ml-auto flex items-center gap-2">
                  <button
                    onClick={() => confirmTag(true)}
                    className="rounded-md bg-[var(--data-positive)] px-3 py-1 text-xs font-semibold text-black hover:opacity-90"
                  >
                    Yes
                  </button>
                  <button
                    onClick={() => confirmTag(false)}
                    className="rounded-md bg-[var(--data-negative)] px-3 py-1 text-xs font-semibold text-black hover:opacity-90"
                  >
                    No
                  </button>
                  <button
                    onClick={cancelPending}
                    className="rounded-md border border-[var(--border-default)] px-3 py-1 text-xs hover:bg-[var(--bg-elevated)]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="surface p-5">
            <div className="metric-label mb-3">Speed over time (m/s)</div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={readings.map((r) => ({ t: Number(r.time.toFixed(2)), speed: Number(r.speed.toFixed(3)) }))}
                  onClick={(e: any) => {
                    const t = e?.activeLabel;
                    if (typeof t === "number" && playbackRef.current) {
                      playbackRef.current.currentTime = t;
                      setCurrentTime(t);
                    }
                  }}
                >
                  <CartesianGrid stroke="var(--border-subtle)" vertical={false} />
                  <XAxis
                    dataKey="t"
                    type="number"
                    domain={[0, duration || "auto"]}
                    tick={{ fill: "var(--text-secondary)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `${Number(v).toFixed(1)}`}
                  />
                  <YAxis tick={{ fill: "var(--text-secondary)", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)", borderRadius: 8, fontSize: 12 }} />
                  <Area type="monotone" dataKey="speed" stroke="var(--fencing)" fill="var(--fencing)" fillOpacity={0.25} strokeWidth={2.5} />
                  {tags.map((tg) => (
                    <ReferenceLine
                      key={tg.id}
                      x={Number(tg.time.toFixed(2))}
                      stroke={ACTION_COLORS[tg.action]}
                      strokeWidth={2}
                      ifOverflow="extendDomain"
                      label={{ value: tg.action[0], position: "top", fill: ACTION_COLORS[tg.action], fontSize: 10 }}
                    />
                  ))}
                  <ReferenceLine x={currentTime} stroke="#ffffff" strokeWidth={2} ifOverflow="extendDomain" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="surface overflow-hidden">
            <div className="px-5 py-3 border-b border-[var(--border-subtle)]">
              <div className="metric-label">Tagged actions ({tags.length})</div>
            </div>
            {tags.length === 0 ? (
              <div className="px-5 py-6 text-center text-xs text-[var(--text-secondary)]">
                No tags yet — use the buttons above while watching the video.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-[var(--bg-elevated)] text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">
                  <tr>
                    <th className="px-5 py-2 text-left">Time (s)</th>
                    <th className="px-5 py-2 text-left">Action</th>
                    <th className="px-5 py-2 text-left">Speed (m/s)</th>
                    <th className="px-5 py-2 text-left">Direction</th>
                    <th className="px-5 py-2 w-10" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {tags.map((tg) => {
                    const r = speedAt(tg.time);
                    return (
                      <tr key={tg.id} className="row-hover">
                        <td className="px-5 py-2 tabular-nums">
                          <button
                            onClick={() => {
                              if (playbackRef.current) {
                                playbackRef.current.currentTime = tg.time;
                                setCurrentTime(tg.time);
                              }
                            }}
                            className="underline-offset-2 hover:underline"
                          >
                            {tg.time.toFixed(2)}
                          </button>
                        </td>
                        <td className="px-5 py-2">
                          <span
                            className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-black"
                            style={{ background: ACTION_COLORS[tg.action] }}
                          >
                            {tg.action}
                          </span>
                        </td>
                        <td className="px-5 py-2 tabular-nums">{r ? r.speed.toFixed(3) : "—"}</td>
                        <td className="px-5 py-2 text-[var(--text-secondary)]">{r?.direction ?? "—"}</td>
                        <td className="px-5 py-2 text-right">
                          <button
                            onClick={() => removeTag(tg.id)}
                            className="inline-flex items-center justify-center rounded-md p-1.5 text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--data-negative)]"
                            aria-label="Delete tag"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {tags.length > 0 && (
            <div className="surface overflow-hidden">
              <div className="px-5 py-3 border-b border-[var(--border-subtle)]">
                <div className="metric-label">Tagged Action Summary</div>
              </div>
              <div className="px-5 py-4">
                <div className="grid gap-3">
                  {Object.entries(
                    tags.reduce<Record<string, ActionTag[]>>((acc, t) => {
                      (acc[t.action] ||= []).push(t);
                      return acc;
                    }, {})
                  )
                    .sort((a, b) => a[0].localeCompare(b[0]))
                    .map(([action, actionTags]) => {
                      const bench = ACTION_BENCHMARKS[action];
                      const speeds = actionTags
                        .map((t) => speedAt(t.time)?.speed)
                        .filter((s): s is number => typeof s === "number");
                      const count = actionTags.length;
                      const peak = speeds.length ? Math.max(...speeds) : 0;
                      const avg = speeds.length ? speeds.reduce((s, v) => s + v, 0) / speeds.length : 0;
                      const value = bench?.metric === "avg" ? avg : peak;
                      const barColor = bench ? getBenchmarkColor(value, bench.eliteMin) : "var(--text-muted)";
                      const barWidth = bench ? Math.min((value / bench.eliteMax) * 100, 100) : 0;
                      return (
                        <div key={action} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                          <span
                            className="shrink-0 self-start rounded-full px-2.5 py-0.5 text-[10px] font-semibold text-black"
                            style={{ background: ACTION_COLORS[action as ActionType] }}
                          >
                            {action}
                          </span>
                          <div className="flex-1 min-w-0 grid grid-cols-3 gap-4 text-sm">
                            <div>
                              <div className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">Count</div>
                              <div className="font-semibold tabular-nums">{count}</div>
                            </div>
                            <div>
                              <div className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">Avg Speed</div>
                              <div className="font-semibold tabular-nums">{avg.toFixed(3)} m/s</div>
                            </div>
                            <div>
                              <div className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">Peak Speed</div>
                              <div className="font-semibold tabular-nums">{peak.toFixed(3)} m/s</div>
                            </div>
                          </div>
                          <div className="w-full sm:w-32 shrink-0">
                            <div className="flex items-center justify-between text-[10px] text-[var(--text-secondary)] mb-1">
                              <span>{bench ? bench.label : "No benchmark"}</span>
                              <span style={{ color: barColor }} className="font-medium">{value.toFixed(2)}</span>
                            </div>
                            <div className="h-1.5 w-full rounded-full bg-[var(--bg-elevated)] overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{ width: `${barWidth}%`, background: barColor }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          )}

          <div className="surface overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--border-subtle)]">
              <div className="metric-label">Readings ({readings.length})</div>
              <button
                onClick={downloadCsv}
                className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-default)] px-3 py-1.5 text-xs hover:bg-[var(--bg-elevated)]"
              >
                <Download className="h-3.5 w-3.5" /> Download CSV
              </button>
            </div>
            <div className="max-h-80 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-[var(--bg-elevated)] text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">
                  <tr>
                    <th className="px-5 py-2 text-left">Time (s)</th>
                    <th className="px-5 py-2 text-left">Speed (m/s)</th>
                    <th className="px-5 py-2 text-left">Direction</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {readings.map((r, i) => (
                    <tr key={i} className="row-hover">
                      <td className="px-5 py-2 tabular-nums">{r.time.toFixed(2)}</td>
                      <td className="px-5 py-2 tabular-nums">{r.speed.toFixed(3)}</td>
                      <td className="px-5 py-2">
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                          style={{
                            background: r.direction === "advance" ? "var(--accent-glow)" : "var(--data-negative)" + "26",
                            color: r.direction === "advance" ? "var(--accent)" : "var(--data-negative)",
                          }}
                        >
                          {r.direction}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <button
            onClick={reset}
            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-default)] px-3 py-1.5 text-xs hover:bg-[var(--bg-elevated)]"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Analyze another video
          </button>
        </>
      )}
    </div>
  );
}

function CoachingCards({
  coaching,
  loading,
  error,
}: {
  coaching: CoachingSummary | null;
  loading: boolean;
  error: string | null;
}) {
  if (!coaching && !loading && !error) return null;

  const sentimentColor = (s: "positive" | "warning" | "critical") =>
    s === "positive" ? "var(--data-positive)" : s === "critical" ? "var(--data-negative)" : "var(--data-warning)";

  return (
    <div className="space-y-3">
      <div className="metric-label">AI Coaching Summary</div>
      {loading && (
        <div className="grid gap-3 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="surface p-4" style={{ borderLeft: "4px solid var(--border-default)" }}>
              <div className="h-3 w-2/3 animate-pulse rounded bg-[var(--bg-elevated)]" />
              <div className="mt-3 space-y-2">
                <div className="h-2 w-full animate-pulse rounded bg-[var(--bg-elevated)]" />
                <div className="h-2 w-5/6 animate-pulse rounded bg-[var(--bg-elevated)]" />
                <div className="h-2 w-4/6 animate-pulse rounded bg-[var(--bg-elevated)]" />
              </div>
            </div>
          ))}
        </div>
      )}
      {error && !loading && (
        <div className="surface p-3 text-xs text-[var(--data-negative)]">{error}</div>
      )}
      {coaching && !loading && (
        <div className="grid gap-3 sm:grid-cols-3">
          {coaching.observations.map((o, i) => (
            <div
              key={i}
              className="surface p-4"
              style={{ borderLeft: `4px solid ${sentimentColor(o.sentiment)}` }}
            >
              <div className="text-sm font-semibold text-[var(--text-primary)]">{o.title}</div>
              <div className="mt-2 text-xs leading-relaxed text-[var(--text-secondary)]">{o.detail}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

