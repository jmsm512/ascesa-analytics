import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell } from "@/components/AppShell";
import { getAthlete, getFencingSession } from "@/lib/data";
import {
  generateCoachingSummary,
  type CoachingSummary,
  type DrillsPlan,
} from "@/lib/coaching.functions";
import { supabase } from "@/integrations/supabase/client";
import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";
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
  Legend,
} from "recharts";
import {
  ArrowLeft,
  Check,
  Upload,
  RotateCcw,
  Download,
  Trash2,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Plus,
  Pencil,
} from "lucide-react";
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { msToFps } from "@/lib/units";
import { SessionEditDelete } from "@/components/SessionEditDelete";
import { uploadVideoToStorage } from "@/lib/video/uploadVideo";
import { Progress } from "@/components/ui/progress";
import { AthleteSelector } from "@/components/AthleteSelector";
import { PoseOverlay } from "@/components/PoseOverlay";

export const Route = createFileRoute("/sessions/fencing/$id")({
  component: FencingSession,
  validateSearch: (s: Record<string, unknown>) => ({
    tab: s.tab === "Video" || s.tab === "Overview" ? (s.tab as "Video" | "Overview") : undefined,
  }),
});

const TABS = ["Overview", "Video"] as const;

// ============= Types =============

type Pt = { x: number; y: number };
type Reading = { time: number; speed: number; direction: "advance" | "retreat" };
type ActionType = "Attack" | "Lunge" | "Parry" | "Riposte" | "Advance" | "Retreat" | "Touch";
type ActionTag = { id: string; time: number; action: ActionType | "Opp Touch"; success: boolean };

type Period = {
  id: string;
  label: string;
  videoPath: string | null;
  readings: Reading[];
  duration: number;
  points: Pt[];
  tags: ActionTag[];
  savedAt: string;
  peakLungeDepth?: number | null;
  avgLungeDepth?: number | null;
};

type SavedAnalysis = {
  periods: Period[];
  coaching?: CoachingSummary;
  drills?: DrillsPlan;
  maskRects?: Array<{x: number, y: number, w: number, h: number}>;
};

const ACTION_COLORS: Record<ActionType | "Opp Touch", string> = {
  Attack: "#ef4444",
  Lunge: "#f97316",
  Parry: "#3b82f6",
  Riposte: "#06b6d4",
  Advance: "#22c55e",
  Retreat: "#ec4899",
  Touch: "#eab308",
  "Opp Touch": "#dc2626",
};
const ACTION_TYPES: ActionType[] = ["Attack", "Lunge", "Parry", "Riposte", "Advance", "Retreat", "Touch"];

const ACTION_BENCHMARKS: Record<string, { metric: "peak" | "avg"; eliteMin: number; eliteMax: number; label: string }> = {
  Lunge: { metric: "peak", eliteMin: 3.5, eliteMax: 5.0, label: "Elite junior: 3.5–5.0 m/s" },
  Attack: { metric: "peak", eliteMin: 3.0, eliteMax: 4.5, label: "Elite junior: 3.0–4.5 m/s" },
  Advance: { metric: "avg", eliteMin: 1.5, eliteMax: 2.5, label: "Elite junior: 1.5–2.5 m/s" },
  Retreat: { metric: "peak", eliteMin: 3.0, eliteMax: 4.5, label: "Elite junior: 3.0–4.5 m/s" },
};

// Violet shades for combined chart (lightest → darkest)
const PERIOD_COLORS = [
  "#c4b5fd", // violet-300
  "#a78bfa", // violet-400
  "#8b5cf6", // violet-500
  "#7c3aed", // violet-600
  "#6d28d9", // violet-700
  "#5b21b6", // violet-800
];
function periodColor(i: number) {
  return PERIOD_COLORS[i % PERIOD_COLORS.length];
}

function normalizeAnalysis(raw: any, legacyVideoPath: string | null): SavedAnalysis {
  if (!raw || typeof raw !== "object") return { periods: [], maskRects: [] };
  if (Array.isArray(raw.periods)) {
    return {
      periods: raw.periods as Period[],
      coaching: raw.coaching,
      drills: raw.drills,
      maskRects: Array.isArray(raw.maskRects) ? raw.maskRects : [],
    };
  }
  if (Array.isArray(raw.readings)) {
    return {
      periods: [
        {
          id:
            (typeof crypto !== "undefined" && (crypto as any).randomUUID?.()) ||
            `p-${Date.now()}`,
          label: "Period 1",
          videoPath: legacyVideoPath,
          readings: raw.readings,
          duration: raw.duration ?? 0,
          points: raw.points ?? [],
          tags: raw.tags ?? [],
          savedAt: raw.savedAt ?? new Date().toISOString(),
        },
      ],
      coaching: raw.coaching,
      drills: raw.drills,
      maskRects: Array.isArray(raw.maskRects) ? raw.maskRects : [],
    };
  }
  return { periods: [], coaching: raw.coaching, drills: raw.drills, maskRects: Array.isArray(raw.maskRects) ? raw.maskRects : [] };
}

function uid() {
  return (typeof crypto !== "undefined" && (crypto as any).randomUUID?.()) || `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
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

// ============= Route Component =============

function FencingSession() {
  const { id } = Route.useParams();
  const search = Route.useSearch();
  const [tab, setTab] = useState<(typeof TABS)[number]>(search.tab ?? "Overview");
  const q = useQuery({ queryKey: ["fencing-session", id], queryFn: () => getFencingSession(id) });
  const session = q.data?.session;
  const fs = q.data?.fs;
  const sensors = q.data?.sensors ?? [];
  const analysis = useMemo(
    () => normalizeAnalysis(q.data?.speedAnalysis ?? null, (q.data as any)?.videoPath ?? null),
    [q.data?.speedAnalysis, (q.data as any)?.videoPath],
  );

  return (
    <RequireAuth>
      <AppShell>
        <Link to="/" className="inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </Link>

        {session && fs && (
          <div className="surface mt-4 p-6" style={{ borderLeft: "4px solid var(--fencing)" }}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="metric-label mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span>Fencing Bout</span>
                  <span className="text-[var(--text-secondary)] normal-case tracking-normal">
                    {format(new Date(session.session_date), "EEEE, MMM d")}
                  </span>
                </div>
                <h1 className="text-2xl font-bold tracking-tight">
                  {(session as any).name?.trim() || format(new Date(session.session_date), "EEEE, MMM d")}
                </h1>
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
              <SessionEditDelete
                session={session as any}
                fencing={{
                  fencingSessionId: fs.id,
                  weapon: fs.weapon ?? null,
                  opponent: fs.opponent ?? null,
                  touches_scored: fs.touches_scored ?? 0,
                  touches_received: fs.touches_received ?? 0,
                  event_name: (fs as any).event_name ?? null,
                  bout_type: (fs as any).bout_type ?? null,
                }}
                onSaved={() => q.refetch()}
              />
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

            <SpeedInsights
              fencingSessionId={fs.id}
              athleteId={session?.athlete_id ?? null}
              analysis={analysis}
              onSaved={() => q.refetch()}
              onGoToVideo={() => setTab("Video")}
            />
          </>
        )}

        {tab === "Video" && (
          <VideoTab
            sessionId={id}
            fencingSessionId={fs?.id ?? null}
            athleteId={session?.athlete_id ?? null}
            analysis={analysis}
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

// ============= Video Tab =============

function VideoTab({
  sessionId,
  fencingSessionId,
  athleteId,
  analysis,
  onSaved,
}: {
  sessionId: string;
  fencingSessionId: string | null;
  athleteId: string | null;
  analysis: SavedAnalysis;
  onSaved: () => void;
}) {
  const [periods, setPeriods] = useState<Period[]>(analysis.periods);
  const [draftPeriodId, setDraftPeriodId] = useState<string | null>(null);
  const [maskRects, setMaskRects] = useState<Array<{x: number, y: number, w: number, h: number}>>(analysis.maskRects ?? []);
  const periodsRef = useRef(periods);
  periodsRef.current = periods;
  const mountedRef = useRef(false);

  // Resync if upstream analysis changes (e.g. after refetch)
  useEffect(() => {
    if (periods.length === 0 && analysis.periods.length > 0) {
      setPeriods(analysis.periods);
    }
  }, [analysis]);

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    void persist(periodsRef.current);
  }, [maskRects]);

  async function persist(next: Period[]) {
    if (!fencingSessionId) return;
    const payload: SavedAnalysis = {
      periods: next,
      coaching: analysis.coaching,
      drills: analysis.drills,
      maskRects,
    };
    await supabase.from("fencing_sessions").update({ speed_analysis: payload } as any).eq("id", fencingSessionId);
    onSaved();
  }

  function updatePeriod(p: Period) {
    const next = periods.some((x) => x.id === p.id)
      ? periods.map((x) => (x.id === p.id ? p : x))
      : [...periods, p];
    setPeriods(next);
    void persist(next);
  }

  function deletePeriod(id: string) {
    if (!confirm("Delete this period and its analysis?")) return;
    const next = periods.filter((p) => p.id !== id);
    setPeriods(next);
    if (draftPeriodId === id) setDraftPeriodId(null);
    void persist(next);
  }

  function addPeriod() {
    const id = uid();
    const nextIndex = periods.length + 1;
    const draft: Period = {
      id,
      label: `Period ${nextIndex}`,
      videoPath: null,
      readings: [],
      duration: 0,
      points: [],
      tags: [],
      savedAt: new Date().toISOString(),
    };
    setPeriods([...periods, draft]);
    setDraftPeriodId(id);
  }

  function cancelDraft(id: string) {
    setPeriods((prev) => prev.filter((p) => p.id !== id));
    setDraftPeriodId(null);
  }

  return (
    <div className="mt-6 space-y-6">
      <BoutSummary periods={periods} />

      <div className="space-y-4">
        {periods.map((p, i) => (
          <PeriodSection
            key={p.id}
            index={i}
            period={p}
            sessionId={sessionId}
            isDraft={p.id === draftPeriodId}
            onChange={updatePeriod}
            onDelete={() => deletePeriod(p.id)}
            onCancelDraft={() => cancelDraft(p.id)}
            onAnalysisComplete={() => setDraftPeriodId(null)}
            maskRects={maskRects}
            setMaskRects={setMaskRects}
          />
        ))}

        <button
          onClick={addPeriod}
          disabled={!fencingSessionId || !!draftPeriodId}
          className="surface flex w-full items-center justify-center gap-2 p-4 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--accent)] hover:text-[var(--text-primary)] disabled:opacity-50"
          style={{ borderStyle: "dashed", borderWidth: 2 }}
        >
          <Plus className="h-4 w-4" /> Add Video
        </button>
      </div>
    </div>
  );
}

// ============= Bout Summary =============

function BoutSummary({ periods }: { periods: Period[] }) {
  const analyzed = periods.filter((p) => p.readings.length > 0);
  if (!analyzed.length) {
    return (
      <div className="surface p-5">
        <div className="metric-label mb-2">Bout Summary</div>
        <div className="text-xs text-[var(--text-secondary)]">
          Upload and analyze a clip below to see aggregated bout stats.
        </div>
      </div>
    );
  }

  const all = analyzed.flatMap((p) => p.readings);
  const peak = all.reduce((m, r) => Math.max(m, r.speed), 0);
  const avg = all.reduce((s, r) => s + r.speed, 0) / all.length;
  const peakAdv = all.filter((r) => r.direction === "advance").reduce((m, r) => Math.max(m, r.speed), 0);
  const peakRet = all.filter((r) => r.direction === "retreat").reduce((m, r) => Math.max(m, r.speed), 0);

  // Build a combined chart: each period's readings on a shared time axis,
  // shifted so periods are sequential (otherwise overlapping times muddle the chart).
  let offset = 0;
  const series = analyzed.map((p, i) => {
    const points = p.readings.map((r) => ({
      t: Number((r.time + offset).toFixed(2)),
      [p.label]: Number(r.speed.toFixed(3)),
    }));
    offset += p.duration || (p.readings[p.readings.length - 1]?.time ?? 0);
    return { period: p, color: periodColor(i), points };
  });
  const merged: Record<number, any> = {};
  for (const s of series) {
    for (const pt of s.points) {
      merged[pt.t] = { ...(merged[pt.t] ?? { t: pt.t }), ...pt };
    }
  }
  const chartData = Object.values(merged).sort((a: any, b: any) => a.t - b.t);

  return (
    <div className="surface p-5" style={{ borderTop: "3px solid #8b5cf6" }}>
      <div className="flex items-center justify-between">
        <div className="metric-label">Bout Summary</div>
        <div className="text-[11px] text-[var(--text-secondary)]">
          {analyzed.length} period{analyzed.length === 1 ? "" : "s"} analyzed
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        <SummaryStat label="Overall peak" value={`${peak.toFixed(2)} m/s`} />
        <SummaryStat label="Overall avg" value={`${avg.toFixed(2)} m/s`} />
        <SummaryStat label="Peak advance" value={`${peakAdv.toFixed(2)} m/s`} />
        <SummaryStat label="Peak retreat" value={`${peakRet.toFixed(2)} m/s`} />
      </div>

      <div className="mt-5 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid stroke="var(--border-subtle)" vertical={false} />
            <XAxis
              dataKey="t"
              type="number"
              domain={[0, "auto"]}
              tick={{ fill: "var(--text-secondary)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${Number(v).toFixed(0)}s`}
            />
            <YAxis tick={{ fill: "var(--text-secondary)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)", borderRadius: 8, fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {series.map((s) => (
              <Line
                key={s.period.id}
                type="monotone"
                dataKey={s.period.label}
                stroke={s.color}
                strokeWidth={2}
                dot={false}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3">
      <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">{label}</div>
      <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}

// ============= Period Section =============

type Stage = "upload" | "uploading" | "extracting" | "calibrate" | "mask" | "select-athlete" | "zone" | "analyzing" | "results";

function PeriodSection({
  index,
  period,
  sessionId,
  isDraft,
  onChange,
  onDelete,
  onCancelDraft,
  onAnalysisComplete,
  maskRects,
  setMaskRects,
}: {
  index: number;
  period: Period;
  sessionId: string;
  isDraft: boolean;
  onChange: (p: Period) => void;
  onDelete: () => void;
  onCancelDraft: () => void;
  onAnalysisComplete: () => void;
  maskRects: Array<{ x: number; y: number; w: number; h: number }>;
  setMaskRects: (r: Array<{ x: number; y: number; w: number; h: number }>) => void;
}) {
  console.log("PeriodSection mount/render, videoPath:", period.videoPath, "stage:", (period.readings.length > 0 || !!period.videoPath) ? "results" : "upload", "dataUrl in init:", !!period.videoPath);
  const hasResults = period.readings.length > 0;
  const initialStage: Stage = hasResults ? "results" : "upload";
  const [stage, setStage] = useState<Stage>(initialStage);
  const [collapsed, setCollapsed] = useState(false);
  const [editingLabel, setEditingLabel] = useState(false);
  const [labelDraft, setLabelDraft] = useState(period.label);

  const [dataUrl, setDataUrl] = useState<string | null>(null); // playback URL (signed or blob)
  const [firstFrame, setFirstFrame] = useState<string | null>(null);
  const [duration, setDuration] = useState(period.duration);
  const [points, setPoints] = useState<Pt[]>(period.points);
  const [progress, setProgress] = useState({ cur: 0, total: 0 });
  const [readings, setReadings] = useState<Reading[]>(period.readings);
  const [tags, setTags] = useState<ActionTag[]>(period.tags);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [uploadedPath, setUploadedPath] = useState<string | null>(period.videoPath);
  const [uploadPct, setUploadPct] = useState(0);
  const [saving, setSaving] = useState(false);
  const [pendingTag, setPendingTag] = useState<{ action: ActionType; time: number } | null>(null);
  const [selectedAthlete, setSelectedAthlete] = useState<number | null>(null);
  const [trackingZone, setTrackingZone] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  
  const [showSkeleton, setShowSkeleton] = useState(true);
  const [lungeAngles, setLungeAngles] = useState<number[]>([]);
  const [rieScore, setRieScore] = useState(0);
  const [oppScore, setOppScore] = useState(0);

  const imgRef = useRef<HTMLImageElement>(null);
  const playbackRef = useRef<HTMLVideoElement>(null);
  const lungeSaveCounterRef = useRef(0);

  // Sign existing video for playback
  useEffect(() => {
    let cancelled = false;
    if (period.videoPath && !dataUrl) {
      supabase.storage
        .from("videos")
        .createSignedUrl(period.videoPath, 60 * 60)
        .then(({ data }) => {
          if (!cancelled && data?.signedUrl) {
            setDataUrl(data.signedUrl);
            const video = document.createElement("video");
            video.crossOrigin = "anonymous";
            video.src = data.signedUrl;
            video.load();
            video.addEventListener("loadeddata", () => {
              video.currentTime = 0.1;
            });
            video.addEventListener("seeked", () => {
              if (cancelled) return;
              const canvas = document.createElement("canvas");
              canvas.width = video.videoWidth;
              canvas.height = video.videoHeight;
              const ctx = canvas.getContext("2d");
              if (ctx) {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                setFirstFrame(canvas.toDataURL());
              }
            }, { once: true });
          }
        });
    }
    return () => {
      cancelled = true;
    };
  }, [period.videoPath, dataUrl]);


  function commit(partial: Partial<Period>) {
    onChange({ ...period, ...partial, savedAt: new Date().toISOString() });
  }

  function saveLabel() {
    const trimmed = labelDraft.trim() || `Period ${index + 1}`;
    setEditingLabel(false);
    if (trimmed !== period.label) commit({ label: trimmed });
  }

  function startTag(action: ActionType) {
    const t = playbackRef.current?.currentTime ?? currentTime;
    setPendingTag({ action, time: t });
  }
  function confirmTag(success: boolean) {
    if (!pendingTag) return;
    const next = [
      ...tags,
      { id: uid(), time: pendingTag.time, action: pendingTag.action, success },
    ].sort((a, b) => a.time - b.time);
    setTags(next);
    setPendingTag(null);
    commit({ tags: next });
    if (success) setRieScore((s) => s + 1);
  }
  function logOppTouch() {
    const t = playbackRef.current?.currentTime ?? currentTime;
    setOppScore((s) => s + 1);
    const next = [
      ...tags,
      { id: uid(), time: t, action: "Opp Touch" as const, success: false },
    ].sort((a, b) => a.time - b.time);
    setTags(next);
    commit({ tags: next });
  }
  function cancelPending() {
    setPendingTag(null);
  }
  function removeTag(id: string) {
    const next = tags.filter((t) => t.id !== id);
    setTags(next);
    commit({ tags: next });
  }

  function speedAt(t: number): Reading | null {
    if (!readings.length) return null;
    const window = readings.filter((r) => r.time >= t && r.time <= t + 1.0);
    if (window.length) {
      return window.reduce((best, r) => (r.speed > best.speed ? r : best), window[0]);
    }
    let best = readings[0];
    let bestDiff = Math.abs(best.time - t);
    for (const r of readings) {
      const d = Math.abs(r.time - t);
      if (d < bestDiff) {
        best = r;
        bestDiff = d;
      }
    }
    return best;
  }


  async function onFile(file: File) {
    setError(null);
    const isMov = /\.mov$/i.test(file.name) || file.type === "video/quicktime";
    setWarning(isMov ? "MOV files may not be supported. If upload fails, open in QuickTime → Export As → 1080p to convert to MP4." : null);
    setPendingFile(file);
    setStage("uploading");
    setUploadPct(0);
    try {
      const { data: u } = await supabase.auth.getUser();
      const userId = u.user?.id;
      if (!userId) throw new Error("Not signed in");
      const ext = (file.name.split(".").pop() || "mp4").toLowerCase();
      const path = `${userId}/${sessionId}/${period.id}.${ext}`;
      const { signedUrl } = await uploadVideoToStorage(file, path, setUploadPct);
      const { error: sessionVideoError } = await supabase
        .from("sessions")
        .update({ video_url: path })
        .eq("id", sessionId);
      if (sessionVideoError) throw sessionVideoError;
      const { error: fencingVideoError } = await supabase
        .from("fencing_sessions")
        .update({ video_url: path } as any)
        .eq("session_id", sessionId);
      if (fencingVideoError) throw fencingVideoError;
      setUploadedPath(path);
      setDataUrl(signedUrl);
      // Persist the storage path to the session record immediately so the
      // video survives even if the user navigates away before analysis runs.
      commit({ videoPath: path });
      setStage("extracting");
      const { frame, dur } = await extractFirstFrame(signedUrl);
      setFirstFrame(frame);
      setDuration(dur);
      setStage("calibrate");
    } catch (e: any) {
      setError(e?.message ?? "Upload failed");
      setStage("upload");
    }
  }

  function onImgClick(e: React.MouseEvent<HTMLImageElement>) {
    if (points.length >= 2) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const next = [...points, { x, y }];
    setPoints(next);
    if (next.length === 2) {
      setStage("mask");
    }
  }

  async function runAnalysis() {
    if (!dataUrl || points.length < 2) return;
    setStage("analyzing");
    setError(null);
    try {
      const v = document.createElement("video");
      v.muted = true;
      v.playsInline = true;
      v.crossOrigin = "anonymous";
      v.src = dataUrl;
      await new Promise<void>((res, rej) => {
        v.addEventListener("loadeddata", () => res(), { once: true });
        v.addEventListener("error", () => rej(new Error("Video error")), { once: true });
      });
      const c = document.createElement("canvas");
      c.width = v.videoWidth;
      c.height = v.videoHeight;
      const ctx = c.getContext("2d")!;

      const step = 0.3;
      const times: number[] = [];
      for (let t = 0; t < v.duration; t += step) times.push(t);
      setProgress({ cur: 0, total: times.length });

      const fileset = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm",
      );
      const landmarker = await PoseLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task",
          delegate: "GPU",
        },
        runningMode: "IMAGE",
        numPoses: 2,
      });

      const out: Reading[] = [];
      console.log("runAnalysis started, readings so far:", out.length);

      const w = c.width;
      const h = c.height;
      const p0px = { x: points[0].x * w, y: points[0].y * h };
      const p1px = { x: points[1].x * w, y: points[1].y * h };
      const pisteDx = p1px.x - p0px.x;
      const pisteDy = p1px.y - p0px.y;
      const pistePx = Math.hypot(pisteDx, pisteDy);
      const metersPerPx = pistePx > 0 ? 14 / pistePx : 0;

      let prevFoot: { x: number; y: number } | null = null;

      for (let i = 0; i < times.length; i++) {
        const t = times[i];
        await new Promise<void>((res) => {
          v.addEventListener("seeked", () => res(), { once: true });
          v.currentTime = t;
        });
        ctx.drawImage(v, 0, 0);
        for (const r of maskRects) {
          ctx.fillStyle = "black";
          ctx.fillRect(r.x * c.width, r.y * c.height, r.w * c.width, r.h * c.height);
        }

        const result = landmarker.detect(c);
        const lms = result.landmarks?.[0];
        if (lms && lms[27] && lms[28]) {
          const foot = {
            x: ((lms[27].x + lms[28].x) / 2) * w,
            y: ((lms[27].y + lms[28].y) / 2) * h,
          };
          if (prevFoot) {
            const dx = foot.x - prevFoot.x;
            const dy = foot.y - prevFoot.y;
            const distPx = Math.hypot(dx, dy);
            const speed = (distPx * metersPerPx) / step;
            if (speed > 12) {
              prevFoot = null;
              setProgress({ cur: i + 1, total: times.length });
              continue;
            }
            // Direction: dot product of movement with vector toward points[0]
            const toP0x = p0px.x - prevFoot.x;
            const toP0y = p0px.y - prevFoot.y;
            const dot = dx * toP0x + dy * toP0y;
            const direction: "advance" | "retreat" = dot >= 0 ? "advance" : "retreat";
            out.push({ time: t, speed, direction });
          }
          prevFoot = foot;
        }

        setProgress({ cur: i + 1, total: times.length });
      }

      landmarker.close();

      setReadings(out);
      setStage("results");
      setCollapsed(false);
      setSaving(true);
      try {
        const videoPath = uploadedPath ?? period.videoPath;
        onChange({
          ...period,
          readings: out,
          points,
          duration: v.duration,
          videoPath,
          savedAt: new Date().toISOString(),
        });
        onAnalysisComplete();
      } finally {
        setSaving(false);
        console.log("runAnalysis finished, total readings:", out.length);
      }
    } catch (e: any) {
      setError(e?.message ?? "Analysis failed");
      setStage("calibrate");
    }
  }

  function resetAnalysis() {
    if (!confirm("Reset this period? The video and analysis will be removed.")) return;
    setStage("upload");
    setDataUrl(null);
    setFirstFrame(null);
    setDuration(0);
    setPoints([]);
    setReadings([]);
    setTags([]);
    setProgress({ cur: 0, total: 0 });
    setUploadedPath(null);
    setUploadPct(0);
    setPendingFile(null);
    setError(null);
    onChange({
      ...period,
      readings: [],
      tags: [],
      points: [],
      duration: 0,
      videoPath: null,
      savedAt: new Date().toISOString(),
    });
  }

  function downloadCsv() {
    const lines = ["time_s,speed_ms,direction"];
    for (const r of readings) lines.push(`${r.time.toFixed(3)},${r.speed.toFixed(4)},${r.direction}`);
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${period.label.replace(/\s+/g, "-")}-speed.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const peak = readings.reduce((m, r) => Math.max(m, r.speed), 0);
  const avg = readings.length ? readings.reduce((s, r) => s + r.speed, 0) / readings.length : 0;
  const accent = periodColor(index);

  return (
    <div className="surface overflow-hidden" style={{ borderLeft: `4px solid ${accent}` }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-[var(--border-subtle)]">
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]"
          aria-label={collapsed ? "Expand" : "Collapse"}
        >
          {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </button>
        {editingLabel ? (
          <>
            <input
              list="period-label-options"
              value={labelDraft}
              onChange={(e) => setLabelDraft(e.target.value)}
              onBlur={saveLabel}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveLabel();
                if (e.key === "Escape") {
                  setLabelDraft(period.label);
                  setEditingLabel(false);
                }
              }}
              autoFocus
              className="rounded border border-[var(--border-default)] bg-[var(--bg-elevated)] px-2 py-0.5 text-sm font-semibold"
            />
            <datalist id="period-label-options">
              <option value="Pool 1" />
              <option value="Pool 2" />
              <option value="Pool 3" />
              <option value="Pool 4" />
              <option value="Pool 5" />
              <option value="Pool 6" />
              <option value="DE Round of 64" />
              <option value="DE Round of 32" />
              <option value="DE Round of 16" />
              <option value="DE Quarterfinal" />
              <option value="DE Semifinal" />
              <option value="DE Final" />
              <option value="Practice" />
              <option value="Home Training" />
            </datalist>
          </>
        ) : (
          <button
            onClick={() => {
              setLabelDraft(period.label);
              setEditingLabel(true);
            }}
            className="inline-flex items-center gap-1.5 text-sm font-semibold hover:text-[var(--accent)]"
          >
            {period.label}
            <Pencil className="h-3 w-3 text-[var(--text-muted)]" />
          </button>
        )}

        {hasResults && (
          <div className="ml-auto flex items-center gap-4 text-[11px] text-[var(--text-secondary)]">
            <span>Peak <span className="tabular-nums text-[var(--text-primary)]">{peak.toFixed(2)}</span> m/s</span>
            <span>Avg <span className="tabular-nums text-[var(--text-primary)]">{avg.toFixed(2)}</span> m/s</span>
            <span>{tags.length} tag{tags.length === 1 ? "" : "s"}</span>
          </div>
        )}

        <button
          onClick={isDraft && !hasResults ? onCancelDraft : onDelete}
          title={isDraft && !hasResults ? "Cancel" : "Delete period"}
          className={`${hasResults ? "" : "ml-auto"} inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--data-negative)]`}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {!collapsed && (
        <div className="space-y-6 p-5">
          {error && (
            <div className="rounded-md border border-[var(--data-negative)]/40 bg-[var(--data-negative)]/10 p-3 text-sm text-[var(--data-negative)]">
              {error}
            </div>
          )}
          {warning && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-500">
              {warning}
            </div>
          )}

          {stage === "upload" && (
            <label
              className="surface flex cursor-pointer flex-col items-center justify-center gap-3 p-12 text-center transition-colors hover:border-[var(--accent)]"
              style={{ borderWidth: 2, borderStyle: "dashed" }}
            >
              <Upload className="h-7 w-7 text-[var(--text-secondary)]" />
              <div className="text-sm font-medium">Upload a clip for {period.label}</div>
              <div className="text-xs text-[var(--text-secondary)]">Any size supported — video uploads directly to secure storage.</div>
              <div className="text-xs text-[var(--text-secondary)]">MP4 recommended · MOV may need conversion</div>
              <input
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
              />
            </label>
          )}

          {stage === "uploading" && (
            <div className="surface space-y-3 p-8">
              <div className="text-sm font-medium">Uploading video… {uploadPct}%</div>
              <Progress value={uploadPct} />
              <div className="text-xs text-[var(--text-secondary)]">Streaming directly to secure storage — large files OK.</div>
            </div>
          )}

          {stage === "extracting" && (
            <div className="surface grid place-items-center p-12 text-sm text-[var(--text-secondary)]">
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
                  <div className="self-center text-xs text-[var(--text-secondary)]">
                    Calibration set.
                  </div>
                )}
              </div>
            </div>
          )}

          {stage === "mask" && firstFrame && (
            <MaskStage
              frameDataUrl={firstFrame}
              maskRects={maskRects}
              setMaskRects={setMaskRects}
              onDone={() => setStage("select-athlete")}
            />
          )}



          {stage === "zone" && firstFrame && (
            <ZoneSelector
              frameDataUrl={firstFrame}
              zone={trackingZone}
              setZone={setTrackingZone}
              onConfirm={() => {
                setStage("select-athlete");
              }}
            />
          )}

          {stage === "select-athlete" && firstFrame && (
            <AthleteSelector
              frameDataUrl={firstFrame}
              maskRects={maskRects}
              onSelect={(idx) => {
                setSelectedAthlete(idx);
                void runAnalysis();
              }}
              onCancel={() => {
                setPoints([]);
                setStage("calibrate");
              }}
            />
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
                <div className="flex items-center gap-3 text-xs text-[var(--text-secondary)]">
                  <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-[var(--accent)]" />
                  Saving analysis…
                </div>
              )}

              {readings.length > 0 && (
                <div>
                  <div className="metric-label mb-3">Speed over time (m/s)</div>
                  <div className="h-56">
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
                        <Area type="monotone" dataKey="speed" stroke={accent} fill={accent} fillOpacity={0.25} strokeWidth={2.5} />
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
              )}


              <div className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4">
                <div className="mb-3 text-center">
                  <div className="text-2xl font-bold tracking-tight">
                    <span style={{ color: "var(--accent)" }}>RIE {rieScore}</span>
                    <span className="mx-2 text-[var(--text-secondary)]">—</span>
                    <span style={{ color: "var(--data-negative)" }}>OPP {oppScore}</span>
                  </div>
                  <button
                    onClick={() => { setRieScore(0); setOppScore(0); }}
                    className="mt-1 text-[11px] text-[var(--text-muted)] underline-offset-2 hover:underline"
                  >
                    Reset score
                  </button>
                </div>
                <div className="metric-label mb-1">Tag action at {currentTime.toFixed(2)}s</div>
                <p className="mb-3 text-[11px] text-[var(--text-muted)]">Tag at the moment the action begins — the first movement of the feet.</p>
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
                  <button
                    onClick={logOppTouch}
                    disabled={!!pendingTag}
                    className="rounded-md px-3 py-1.5 text-xs font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-40"
                    style={{ background: "var(--data-negative)" }}
                  >
                    Opp Touch
                  </button>
                </div>
                {pendingTag && (
                  <div className="mt-3 flex flex-wrap items-center gap-3 rounded-md border border-[var(--border-default)] bg-[var(--bg-default)] px-3 py-2">
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

              {tags.length > 0 && (
                <div className="overflow-hidden rounded-md border border-[var(--border-subtle)]">
                  <div className="bg-[var(--bg-elevated)] px-5 py-2 metric-label">Tagged actions ({tags.length})</div>
                  <table className="w-full text-sm">
                    <thead className="bg-[var(--bg-elevated)] text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">
                      <tr>
                        <th className="px-5 py-2 text-left">Time (s)</th>
                        <th className="px-5 py-2 text-left">Action</th>
                        <th className="px-5 py-2 text-left">Result</th>
                        <th className="px-5 py-2 text-left">Peak speed (1s window)</th>
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
                            <td className="px-5 py-2">
                              <span
                                className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-black"
                                style={{ background: tg.success ? "var(--data-positive)" : "var(--data-negative)" }}
                              >
                                {tg.success ? "Success" : "Fail"}
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
                </div>
              )}

              {tags.length > 0 && (
                <TaggedActionSummary tags={tags} speedAt={speedAt} />
              )}

              {readings.length > 0 && (
                <div className="overflow-hidden rounded-md border border-[var(--border-subtle)]">
                  <div className="flex items-center justify-between bg-[var(--bg-elevated)] px-5 py-2">
                    <div className="metric-label">Readings ({readings.length})</div>
                    <button
                      onClick={downloadCsv}
                      className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-default)] px-3 py-1 text-xs hover:bg-[var(--bg-default)]"
                    >
                      <Download className="h-3 w-3" /> CSV
                    </button>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
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
                            <td className="px-5 py-2 text-[var(--text-secondary)]">{r.direction}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div>
                <button
                  onClick={resetAnalysis}
                  className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-default)] px-3 py-1.5 text-xs hover:bg-[var(--bg-elevated)]"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Reset this clip
                </button>
              </div>
            </>
          )}
          {dataUrl && (
            <div className="space-y-2">
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowSkeleton((s) => !s)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-default)] px-3 py-1.5 text-xs hover:bg-[var(--bg-elevated)]"
                >
                  {showSkeleton ? "Hide Skeleton" : "Show Skeleton"}
                </button>
                <button
                  onClick={() => {
                    playbackRef.current?.pause();
                    setSelectedAthlete(null);
                    setLungeAngles([]);
                    setCollapsed(false);
                    setStage("mask");
                  }}
                  className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-default)] px-3 py-1.5 text-xs hover:bg-[var(--bg-elevated)]"
                >
                  Re-select
                </button>
                <button
                  onClick={() => {
                    setSelectedAthlete(selectedAthlete === 0 ? 1 : 0);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-default)] px-3 py-1.5 text-xs hover:bg-[var(--bg-elevated)]"
                >
                  Switch Athlete
                </button>
              </div>
              <div style={{ position: "relative" }} className="overflow-hidden rounded-lg">
                <video
                  ref={playbackRef}
                  src={dataUrl}
                  controls
                  playsInline
                  crossOrigin="anonymous"
                  onTimeUpdate={(e) => setCurrentTime((e.target as HTMLVideoElement).currentTime)}
                  onSeeked={(e) => setCurrentTime((e.target as HTMLVideoElement).currentTime)}
                  className="w-full rounded-md bg-black"
                  style={{ maxHeight: 480 }}
                />
                <PoseOverlay
                  videoRef={playbackRef}
                  targetIndex={selectedAthlete ?? 0}
                  trackingZone={trackingZone}
                  maskRects={maskRects}
                  visible={showSkeleton}
                  onLungeData={(angle) => {
                    setLungeAngles((prev) => {
                      const next = [...prev, angle];
                      lungeSaveCounterRef.current += 1;
                      if (lungeSaveCounterRef.current >= 10 && next.length > 0) {
                        lungeSaveCounterRef.current = 0;
                        commit({
                          peakLungeDepth: Math.min(...next),
                          avgLungeDepth: next.reduce((a, b) => a + b, 0) / next.length,
                        });
                      }
                      return next;
                    });
                  }}
                />

              </div>
              {(lungeAngles.length > 0 || period.peakLungeDepth != null || period.avgLungeDepth != null) && (
                <div className="grid grid-cols-2 gap-2 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3">
                  <div>
                    <div className="metric-label">Peak Lunge Depth</div>
                    <div className="text-lg font-semibold">
                      {(lungeAngles.length > 0 ? Math.min(...lungeAngles) : (period.peakLungeDepth ?? 0)).toFixed(1)}°
                    </div>
                  </div>
                  <div>
                    <div className="metric-label">Average Lunge Depth</div>
                    <div className="text-lg font-semibold">
                      {(lungeAngles.length > 0
                        ? lungeAngles.reduce((a, b) => a + b, 0) / lungeAngles.length
                        : (period.avgLungeDepth ?? 0)).toFixed(1)}°
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============= Tagged Action Summary =============

function TaggedActionSummary({ tags, speedAt }: { tags: ActionTag[]; speedAt: (t: number) => Reading | null }) {
  return (
    <div className="overflow-hidden rounded-md border border-[var(--border-subtle)]">
      <div className="bg-[var(--bg-elevated)] px-5 py-2 metric-label">Tagged Action Summary</div>
      <div className="px-5 py-4">
        <div className="grid gap-3">
          {(() => {
            const byAction = tags.reduce<Record<string, ActionTag[]>>((acc, t) => {
              (acc[t.action] ||= []).push(t);
              return acc;
            }, {});
            const speedOf = (t: ActionTag) => speedAt(t.time)?.speed;
            return Object.keys(byAction)
              .sort()
              .flatMap((action) => {
                const actionTagsAll = byAction[action];
                const successTags = actionTagsAll.filter((t) => t.success);
                const failTags = actionTagsAll.filter((t) => !t.success);
                const successSpeeds = successTags.map(speedOf).filter((s): s is number => typeof s === "number");
                const failSpeeds = failTags.map(speedOf).filter((s): s is number => typeof s === "number");
                const avgOf = (a: number[]) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);
                const avgSuccess = avgOf(successSpeeds);
                const avgFail = avgOf(failSpeeds);

                const rows: React.ReactNode[] = [];
                (["success", "fail"] as const).forEach((outcome) => {
                  const actionTags = outcome === "success" ? successTags : failTags;
                  if (!actionTags.length) return;
                  const isSuccess = outcome === "success";
                  const bench = ACTION_BENCHMARKS[action as ActionType | "Opp Touch"];
                  const speeds = actionTags
                    .map((t) => speedAt(t.time)?.speed)
                    .filter((s): s is number => typeof s === "number");
                  const count = actionTags.length;
                  const peak = speeds.length ? Math.max(...speeds) : 0;
                  const avg = speeds.length ? speeds.reduce((s, v) => s + v, 0) / speeds.length : 0;
                  const value = bench?.metric === "avg" ? avg : peak;
                  const barColor = bench ? getBenchmarkColor(value, bench.eliteMin) : "var(--text-muted)";
                  const barWidth = bench ? Math.min((value / bench.eliteMax) * 100, 100) : 0;
                  rows.push(
                    <div key={`${action}|${outcome}`} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                      <div className="flex shrink-0 items-center gap-2 self-start">
                        <span
                          className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold text-black"
                          style={{ background: ACTION_COLORS[action as ActionType | "Opp Touch"] }}
                        >
                          {action}
                        </span>
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-black"
                          style={{ background: isSuccess ? "var(--data-positive)" : "var(--data-negative)" }}
                        >
                          {isSuccess ? "Success" : "Fail"}
                        </span>
                      </div>
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
                });

                if (successSpeeds.length >= 2 && failSpeeds.length >= 2 && avgSuccess > avgFail) {
                  const threshold = (avgSuccess + avgFail) / 2;
                  const allWithSpeed = actionTagsAll
                    .map((t) => ({ s: speedOf(t), ok: t.success }))
                    .filter((x): x is { s: number; ok: boolean } => typeof x.s === "number");
                  const above = allWithSpeed.filter((x) => x.s >= threshold);
                  const aboveSuccessRate = above.length
                    ? Math.round((above.filter((x) => x.ok).length / above.length) * 100)
                    : 0;
                  rows.push(
                    <div
                      key={`${action}|insight`}
                      className="rounded-md border border-[var(--accent)]/30 bg-[var(--accent)]/5 px-3 py-2 text-xs text-[var(--text-secondary)]"
                    >
                      <span className="font-semibold text-[var(--accent)]">Speed threshold:</span>{" "}
                      ~{threshold.toFixed(2)} m/s — actions above this speed succeed{" "}
                      <span className="font-semibold tabular-nums text-[var(--text-primary)]">{aboveSuccessRate}%</span> of the time.
                    </div>
                  );
                }

                return rows;
              });
          })()}
        </div>
      </div>
    </div>
  );
}

// ============= Coaching Cards =============

function CoachingCards({
  coaching,
  loading,
  error,
  onRegenerate,
}: {
  coaching: CoachingSummary | null;
  loading: boolean;
  error: string | null;
  onRegenerate?: () => void;
}) {
  if (!coaching && !loading && !error) return null;

  const sentimentColor = (s: "positive" | "warning" | "critical") =>
    s === "positive" ? "var(--data-positive)" : s === "critical" ? "var(--data-negative)" : "var(--data-warning)";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="metric-label">AI Coaching Summary</div>
        {onRegenerate && (
          <button
            onClick={onRegenerate}
            disabled={loading}
            title="Regenerate coaching summary"
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] disabled:opacity-50"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} /> Regenerate
          </button>
        )}
      </div>
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

// ============= Speed Insights (Overview) =============

function SpeedInsights({
  fencingSessionId,
  athleteId,
  analysis,
  onSaved,
  onGoToVideo,
}: {
  fencingSessionId: string;
  athleteId: string | null;
  analysis: SavedAnalysis;
  onSaved: () => void;
  onGoToVideo: () => void;
}) {
  const generateCoaching = useServerFn(generateCoachingSummary);
  const [coaching, setCoaching] = useState<CoachingSummary | null>(analysis.coaching ?? null);
  const [coachingLoading, setCoachingLoading] = useState(false);
  const [coachingError, setCoachingError] = useState<string | null>(null);
  const athleteQuery = useQuery({
    queryKey: ["athlete", athleteId],
    queryFn: () => (athleteId ? getAthlete(athleteId) : Promise.resolve(null)),
    enabled: !!athleteId,
  });

  useEffect(() => {
    setCoaching(analysis.coaching ?? null);
  }, [analysis.coaching]);

  const analyzed = analysis.periods.filter((p) => p.readings.length > 0);
  const allReadings = useMemo(() => analyzed.flatMap((p) => p.readings), [analyzed]);
  const totalDuration = analyzed.reduce((s, p) => s + (p.duration || 0), 0);

  const peak = allReadings.reduce((m, r) => Math.max(m, r.speed), 0);
  const avg = allReadings.length ? allReadings.reduce((s, r) => s + r.speed, 0) / allReadings.length : 0;
  const peakAdv = allReadings.filter((r) => r.direction === "advance").reduce((m, r) => Math.max(m, r.speed), 0);
  const peakRet = allReadings.filter((r) => r.direction === "retreat").reduce((m, r) => Math.max(m, r.speed), 0);

  async function runCoaching() {
    if (!athleteQuery.data || !allReadings.length || coachingLoading) return;
    setCoachingLoading(true);
    setCoachingError(null);
    try {
      const c = await generateCoaching({
        data: {
          athleteName: athleteQuery.data.name,
          athleteAge: athleteQuery.data.age,
          peakSpeed: peak,
          avgSpeed: avg,
          peakAdvance: peakAdv,
          peakRetreat: peakRet,
          readingCount: allReadings.length,
          duration: totalDuration,
        },
      });
      setCoaching(c);
      const payload: SavedAnalysis = { ...analysis, coaching: c };
      await supabase.from("fencing_sessions").update({ speed_analysis: payload } as any).eq("id", fencingSessionId);
      onSaved();
    } catch (e: any) {
      setCoachingError(e?.message ?? "Failed to generate coaching summary");
    } finally {
      setCoachingLoading(false);
    }
  }

  // Auto-generate once on first analysis
  useEffect(() => {
    if (coaching || coachingLoading) return;
    if (!allReadings.length) return;
    if (!athleteQuery.data) return;
    void runCoaching();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allReadings.length, athleteQuery.data]);

  if (!allReadings.length) {
    return (
      <div className="mt-6 surface flex items-center justify-between gap-4 p-4 text-xs text-[var(--text-secondary)]">
        <span>Upload and analyze a video to see speed insights.</span>
        <button
          onClick={onGoToVideo}
          className="rounded-md border border-[var(--border-default)] px-3 py-1.5 text-[11px] font-medium text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]"
        >
          Go to Video
        </button>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-6">
      {analyzed.length > 1 && (
        <div className="text-[11px] text-[var(--text-secondary)]">
          Aggregated across {analyzed.length} periods.
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-4">
        <BenchmarkStatCard label="Peak speed (m/s)" value={peak.toFixed(2)} numericValue={peak} benchmarkText="Elite junior fencers: 4–6 m/s. Olympic level: 6–8 m/s" eliteMin={4} />
        <BenchmarkStatCard label="Avg speed (m/s)" value={avg.toFixed(2)} numericValue={avg} benchmarkText="Higher average means more aggressive pressure footwork. Elite avg: 1.2–2.0 m/s" eliteMin={1.2} />
        <BenchmarkStatCard label="Peak advance (m/s)" value={peakAdv.toFixed(2)} numericValue={peakAdv} benchmarkText="Explosive advance drives attacks. Elite junior: 3.5–5.0 m/s" eliteMin={3.5} />
        <BenchmarkStatCard label="Peak retreat (m/s)" value={peakRet.toFixed(2)} numericValue={peakRet} benchmarkText="Fast retreat indicates good defensive instincts. Elite junior: 3.0–4.5 m/s" eliteMin={3.0} />
      </div>

      <CoachingCards
        coaching={coaching}
        loading={coachingLoading}
        error={coachingError}
        onRegenerate={athleteQuery.data ? runCoaching : undefined}
      />
    </div>
  );
}

function ZoneSelector({
  frameDataUrl,
  zone,
  setZone,
  onConfirm,
}: {
  frameDataUrl: string;
  zone: { x: number; y: number; w: number; h: number } | null;
  setZone: (z: { x: number; y: number; w: number; h: number } | null) => void;
  onConfirm: () => void;
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);

  const getRect = () => containerRef.current?.getBoundingClientRect();

  const onPointerDown = (e: React.PointerEvent) => {
    const r = getRect();
    if (!r) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    startRef.current = { x, y };
    setDrag({ x, y, w: 0, h: 0 });
    setZone(null);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!startRef.current) return;
    const r = getRect();
    if (!r) return;
    const cx = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    const cy = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
    const s = startRef.current;
    const x = Math.min(s.x, cx);
    const y = Math.min(s.y, cy);
    const w = Math.abs(cx - s.x);
    const h = Math.abs(cy - s.y);
    setDrag({ x, y, w, h });
  };

  const onPointerUp = () => {
    if (drag && drag.w > 0.01 && drag.h > 0.01) {
      setZone(drag);
    }
    startRef.current = null;
  };

  const display = zone ?? drag;

  return (
    <div className="surface p-4 space-y-3">
      <p className="text-sm text-[var(--text-secondary)]">
        Draw a box around the piste where your athlete competes. People outside this box will be ignored.
      </p>
      <div
        ref={containerRef}
        className="relative inline-block w-full overflow-hidden rounded-md select-none touch-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <img ref={imgRef} src={frameDataUrl} alt="frame" className="block w-full pointer-events-none" draggable={false} />
        {display && (
          <div
            className="absolute border-2 border-[var(--accent)] bg-[var(--accent)]/20 pointer-events-none"
            style={{
              left: `${display.x * 100}%`,
              top: `${display.y * 100}%`,
              width: `${display.w * 100}%`,
              height: `${display.h * 100}%`,
            }}
          />
        )}
      </div>
      <div className="flex gap-2">
        <button
          onClick={onConfirm}
          disabled={!zone}
          className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-black disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Confirm Zone
        </button>
        <button
          onClick={() => { setZone(null); setDrag(null); }}
          className="rounded-md border border-[var(--border-default)] px-4 py-2 text-sm hover:bg-[var(--bg-elevated)]"
        >
          Redraw
        </button>
      </div>
    </div>
  );
}

function MaskStage({
  frameDataUrl,
  maskRects,
  setMaskRects,
  onDone,
}: {
  frameDataUrl: string;
  maskRects: Array<{ x: number; y: number; w: number; h: number }>;
  setMaskRects: (r: Array<{ x: number; y: number; w: number; h: number }>) => void;
  onDone: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);

  const getRect = () => containerRef.current?.getBoundingClientRect();

  const onPointerDown = (e: React.PointerEvent) => {
    const r = getRect();
    if (!r) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    startRef.current = { x, y };
    setDrag({ x, y, w: 0, h: 0 });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!startRef.current) return;
    const r = getRect();
    if (!r) return;
    const cx = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    const cy = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
    const s = startRef.current;
    setDrag({
      x: Math.min(s.x, cx),
      y: Math.min(s.y, cy),
      w: Math.abs(cx - s.x),
      h: Math.abs(cy - s.y),
    });
  };

  const onPointerUp = () => {
    if (drag && drag.w > 0.01 && drag.h > 0.01) {
      setMaskRects([...maskRects, drag]);
    }
    setDrag(null);
    startRef.current = null;
  };

  return (
    <div className="surface p-4 space-y-3">
      <p className="text-sm text-[var(--text-secondary)]">
        Click and drag to black out people you want to ignore. Click Done when finished.
      </p>
      <div
        ref={containerRef}
        className="relative inline-block w-full overflow-hidden rounded-md select-none touch-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <img src={frameDataUrl} alt="frame" className="block w-full pointer-events-none" draggable={false} />
        {maskRects.map((r, i) => (
          <div
            key={i}
            className="absolute bg-black pointer-events-none"
            style={{
              left: `${r.x * 100}%`,
              top: `${r.y * 100}%`,
              width: `${r.w * 100}%`,
              height: `${r.h * 100}%`,
            }}
          />
        ))}
        {drag && (
          <div
            className="absolute bg-black/70 pointer-events-none"
            style={{
              left: `${drag.x * 100}%`,
              top: `${drag.y * 100}%`,
              width: `${drag.w * 100}%`,
              height: `${drag.h * 100}%`,
            }}
          />
        )}
      </div>
      <div className="flex gap-2">
        <button
          onClick={onDone}
          className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-black"
        >
          Done
        </button>
        <button
          onClick={() => setMaskRects([])}
          className="rounded-md border border-[var(--border-default)] px-4 py-2 text-sm hover:bg-[var(--bg-elevated)]"
        >
          Clear
        </button>
      </div>
    </div>
  );
}


