import { createFileRoute, Link, ClientOnly } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell } from "@/components/AppShell";
import { SportIcon } from "@/components/SportIcon";
import { getAthlete, listSessionsForAthlete, getBenchmarks, getGoals } from "@/lib/data";
import { FencingTrackerSection } from "@/components/FencingTrackerSection";
import { supabase } from "@/integrations/supabase/client";
import { generateAthleteDrillPlan, type AthleteDrillPlan, type AthleteDrillPrescription, type DrillKind } from "@/lib/coaching.functions";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { LineChart, Line, AreaChart, Area, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Legend, ReferenceLine } from "recharts";
import { ArrowLeft, ArrowUpDown, ChevronRight, ChevronDown, Sparkles, RefreshCw, Check, Plus, Pencil, Trash2, Upload, RotateCcw, X } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";
import { pickClosestHip, type HipPoint } from "@/lib/video/poseTracking";
import { AthleteSelector } from "@/components/AthleteSelector";
import { formatHeightImperial, formatWeightLb, kmhToMph, msToFps } from "@/lib/units";
import { uploadVideoToStorage } from "@/lib/video/uploadVideo";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/athletes/$id")({
  ssr: false,
  component: AthletePage,
});

const TABS = ["Overview", "Sessions", "Progress", "Benchmarks", "Goals", "Drills"] as const;

function AthletePage() {
  const { id } = Route.useParams();
  const [tab, setTab] = useState<(typeof TABS)[number]>("Overview");
  const athlete = useQuery({ queryKey: ["athlete", id], queryFn: () => getAthlete(id) });
  const sessions = useQuery({ queryKey: ["sessions", id], queryFn: () => listSessionsForAthlete(id) });
  const benchmarks = useQuery({ queryKey: ["benchmarks", id], queryFn: () => getBenchmarks(id) });

  const a = athlete.data;
  const accent = a?.sport === "hockey" ? "var(--hockey)" : "var(--fencing)";

  return (
    <RequireAuth>
      <AppShell>
        <Link to="/" className="inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
          <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
        </Link>

        {a && (
          <div className="surface mt-4 p-6" style={{ borderLeft: `4px solid ${accent}` }}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="metric-label mb-2 flex items-center gap-2">
                  <SportIcon sport={a.sport} className="h-3.5 w-3.5" /> {a.sport}
                </div>
                <h1 className="text-3xl font-bold tracking-tight">{a.name}</h1>
              </div>
              <Link
                to="/sessions/new"
                search={{ athlete: a.id }}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-[#001813] hover:bg-[var(--accent-dim)]"
              >
                + New Session
              </Link>
            </div>
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm text-[var(--text-secondary)]">
              {a.age && <Stat label="Age" value={`${a.age}`} />}
              {a.height_cm && <Stat label="Height" value={formatHeightImperial(a.height_cm)} />}
              {a.weight_kg && <Stat label="Weight" value={formatWeightLb(a.weight_kg)} />}
              {a.position && <Stat label="Position" value={a.position} />}
              {a.weapon && <Stat label="Weapon" value={a.weapon} />}
              {a.team && <Stat label="Team" value={a.team} />}
              {a.club && <Stat label="Club" value={a.club} />}
              {a.rating && <Stat label="Rating" value={a.rating} />}
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

        <div className="mt-6">
          {tab === "Overview" && a && <OverviewTab athleteId={id} athleteName={a.name} sport={a.sport} />}

          {tab === "Sessions" && (
            <div className="surface divide-y divide-[var(--border-subtle)] overflow-hidden">
              {sessions.data?.length === 0 && <Empty>No sessions yet.</Empty>}
              {sessions.data?.map((s) => (
                <Link
                  key={s.id}
                  to={s.sport === "hockey" ? "/sessions/hockey/$id" : "/sessions/fencing/$id"}
                  params={{ id: s.id }}
                  className="row-hover flex items-center gap-4 px-5 py-4"
                >
                  <div className="flex-1">
                    <div className="text-sm font-medium">
                      {s.name?.trim() || <span className="capitalize">{s.session_type}</span>}
                    </div>
                    <div className="text-xs text-[var(--text-secondary)]">
                      {format(new Date(s.session_date), "PP")}
                      {s.name?.trim() ? <span className="capitalize"> · {s.session_type}</span> : null}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-[var(--text-muted)]" />
                </Link>
              ))}
            </div>
          )}

          {tab === "Drills" && a && <DrillsTab athleteId={id} athleteName={a.name} athleteAge={a.age} />}

          {tab === "Progress" && <ProgressCharts athleteId={id} sport={a?.sport ?? "hockey"} />}

          {tab === "Benchmarks" && <BenchmarksTab athleteId={id} athleteName={a?.name ?? ""} />}

          {tab === "Goals" && <GoalsTab athleteId={id} />}
        </div>
      </AppShell>
    </RequireAuth>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">{label}</div>
      <div className="text-sm text-[var(--text-primary)]">{value}</div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="px-5 py-10 text-center text-sm text-[var(--text-secondary)]">{children}</div>;
}

async function loadOverviewData(athleteId: string) {
  const { data: sess } = await supabase
    .from("sessions")
    .select("id, session_date, sport, session_type, name")
    .eq("athlete_id", athleteId)
    .order("session_date", { ascending: false });
  const sessions = sess ?? [];
  const ids = sessions.map((s) => s.id);

  let fsRows: any[] = [];
  if (ids.length) {
    const { data } = await supabase
      .from("fencing_sessions")
      .select("session_id, opponent, result, speed_analysis")
      .in("session_id", ids);
    fsRows = data ?? [];
  }
  const fsBySession = new Map(fsRows.map((r) => [r.session_id, r]));

  // Aggregate speed metrics
  const peakSpeeds: number[] = [];
  const advSpeeds: number[] = [];
  const retSpeeds: number[] = [];
  let analyzedCount = 0;
  for (const fs of fsRows) {
    const { readings } = flattenSpeedAnalysis(fs?.speed_analysis);
    if (!readings.length) continue;
    analyzedCount++;
    const speeds = readings.map((r) => r.speed);
    if (speeds.length) peakSpeeds.push(Math.max(...speeds));
    const adv = readings.filter((r) => r.direction === "advance").map((r) => r.speed);
    const ret = readings.filter((r) => r.direction === "retreat").map((r) => r.speed);
    if (adv.length) advSpeeds.push(adv.reduce((a, b) => a + b, 0) / adv.length);
    if (ret.length) retSpeeds.push(ret.reduce((a, b) => a + b, 0) / ret.length);
  }
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

  const resulted = fsRows.filter((r) => r.result === "win" || r.result === "loss");
  const wins = resulted.filter((r) => r.result === "win").length;
  const winRate = resulted.length ? Math.round((wins / resulted.length) * 100) : null;

  // Recent AI feedback for this athlete's videos
  let recentFeedback: { feedback: string | null; created_at: string } | null = null;
  const { data: vids } = await supabase.from("videos").select("id").eq("athlete_id", athleteId);
  const vidIds = (vids ?? []).map((v) => v.id);
  if (vidIds.length) {
    const { data: fb } = await supabase
      .from("video_ai_feedback")
      .select("feedback, created_at")
      .in("video_id", vidIds)
      .order("created_at", { ascending: false })
      .limit(1);
    recentFeedback = fb?.[0] ?? null;
  }

  // FencingTracker cache + URL
  const { data: ath } = await supabase
    .from("athletes")
    .select("fencing_tracker_url, fencing_tracker_data, fencing_tracker_updated_at")
    .eq("id", athleteId)
    .maybeSingle();

  const recent = sessions.slice(0, 3).map((s) => {
    const fs = fsBySession.get(s.id);
    const { readings } = flattenSpeedAnalysis(fs?.speed_analysis);
    const peak = readings.length ? Math.max(...readings.map((r) => r.speed)) : null;
    return {
      id: s.id,
      sport: s.sport,
      date: s.session_date,
      name: (s as any).name ?? null,
      opponent: fs?.opponent ?? "—",
      result: fs?.result ?? s.session_type,
      peakSpeed: peak,
    };
  });

  return {
    totalSessions: sessions.length,
    analyzedCount,
    avgPeak: avg(peakSpeeds),
    avgAdvance: avg(advSpeeds),
    avgRetreat: avg(retSpeeds),
    winRate,
    winCount: wins,
    boutCount: resulted.length,
    recentFeedback,
    recent,
    fencingTrackerUrl: (ath?.fencing_tracker_url ?? null) as string | null,
    fencingTrackerData: (ath?.fencing_tracker_data ?? null) as import("@/lib/data").FencingTrackerData | null,
    fencingTrackerUpdatedAt: (ath?.fencing_tracker_updated_at ?? null) as string | null,
  };
}

function OverviewTab({ athleteId, athleteName: _athleteName, sport }: { athleteId: string; athleteName: string; sport: "hockey" | "fencing" }) {
  const q = useQuery({ queryKey: ["overview", athleteId], queryFn: () => loadOverviewData(athleteId) });
  const d = q.data;

  if (q.isLoading || !d) {
    return <div className="surface p-6 text-sm text-[var(--text-secondary)]">Loading overview…</div>;
  }

  if (d.totalSessions === 0 && sport !== "fencing") {
    return (
      <div className="surface flex flex-col items-center gap-4 px-6 py-16 text-center">
        <div className="text-base font-medium">No sessions yet — let's change that.</div>
        <p className="max-w-md text-sm text-[var(--text-secondary)]">
          Log your first training session or bout to unlock speed analysis, AI coaching observations, and progress trends.
        </p>
        <Link
          to="/sessions/new"
          search={{ athlete: athleteId }}
          className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[#001813] hover:bg-[var(--accent-dim)]"
        >
          + Start your first session
        </Link>
      </div>
    );
  }

  const fmt = (n: number | null, suffix = " m/s") => (n == null ? "—" : `${n.toFixed(2)}${suffix}`);

  return (
    <div className="space-y-4">
      {/* TOP: FencingTracker competition data */}
      {sport === "fencing" && (
        <FencingTrackerSection
          athleteId={athleteId}
          url={d.fencingTrackerUrl}
          data={d.fencingTrackerData}
          updatedAt={d.fencingTrackerUpdatedAt}
        />
      )}

      {/* MIDDLE: aggregate Ascesa IQ speed stats */}
      {d.totalSessions === 0 ? (
        <div className="surface flex flex-col items-center gap-3 px-6 py-10 text-center">
          <div className="text-sm font-medium">No Ascesa IQ sessions yet.</div>
          <Link
            to="/sessions/new"
            search={{ athlete: athleteId }}
            className="inline-flex items-center gap-1.5 rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[#001813] hover:bg-[var(--accent-dim)]"
          >
            + Start your first session
          </Link>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <OverviewStat label="Sessions analyzed" value={`${d.analyzedCount}`} sub={`${d.totalSessions} total`} />
            <OverviewStat label="Avg peak speed" value={fmt(d.avgPeak)} />
            <OverviewStat label="Avg advance" value={fmt(d.avgAdvance)} />
            <OverviewStat label="Avg retreat" value={fmt(d.avgRetreat)} />
            <OverviewStat
              label="Bout win rate"
              value={d.winRate == null ? "—" : `${d.winRate}%`}
              sub={d.boutCount ? `${d.winCount}W / ${d.boutCount - d.winCount}L` : undefined}
            />
          </div>

          <div className="surface p-5">
            <div className="metric-label mb-3">Recent sessions</div>
            <div className="divide-y divide-[var(--border-subtle)]">
              {d.recent.map((s) => (
                <Link
                  key={s.id}
                  to={s.sport === "hockey" ? "/sessions/hockey/$id" : "/sessions/fencing/$id"}
                  params={{ id: s.id }}
                  className="row-hover flex items-center gap-4 py-3"
                >
                  <div className="flex-1">
                    <div className="text-sm font-medium">{s.name?.trim() || s.opponent}</div>
                    <div className="text-xs text-[var(--text-secondary)]">
                      {format(new Date(s.date), "PP")}
                      {s.name?.trim() && s.opponent && s.opponent !== "—" ? ` · vs ${s.opponent}` : ""}
                    </div>
                  </div>
                  <div className="text-xs capitalize text-[var(--text-secondary)]">{s.result}</div>
                  <div className="w-20 text-right text-sm tabular-nums">
                    {s.peakSpeed == null ? <span className="text-[var(--text-muted)]">—</span> : `${s.peakSpeed.toFixed(2)} m/s`}
                  </div>
                  <ChevronRight className="h-4 w-4 text-[var(--text-muted)]" />
                </Link>
              ))}
            </div>
          </div>
        </>
      )}

      {/* BOTTOM: most recent AI coaching observation */}
      {d.recentFeedback?.feedback && (
        <div className="surface p-5" style={{ borderLeft: "3px solid var(--accent)" }}>
          <div className="metric-label mb-2 flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5" /> Latest AI coaching observation
          </div>
          <p className="text-sm leading-relaxed text-[var(--text-primary)] whitespace-pre-wrap">
            {d.recentFeedback.feedback}
          </p>
          <div className="mt-3 text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
            {format(new Date(d.recentFeedback.created_at), "PP")}
          </div>
        </div>
      )}
    </div>
  );
}

function OverviewStat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="surface p-5">
      <div className="metric-label">{label}</div>
      <div className="metric-num-md mt-2">{value}</div>
      {sub && <div className="mt-1 text-xs text-[var(--text-secondary)]">{sub}</div>}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: "bg-[var(--bg-hover)] text-[var(--text-secondary)]",
    processing: "bg-[var(--data-warning)]/15 text-[var(--data-warning)]",
    complete: "bg-[var(--accent-glow)] text-[var(--accent)]",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${styles[status] ?? styles.pending}`}>
      {status}
    </span>
  );
}

// Elite junior fencing benchmarks (m/s)
const ELITE_BENCHMARKS = {
  peakSpeed: 4.5,
  peakAdvance: 4.2,
  avgSpeed: 2.0,
  peakRetreat: 3.5,
} as const;

// Flatten speed_analysis JSONB into a single readings/tags pair.
// Current shape: { periods: [{ readings: [...], tags: [...] }] }
// Legacy shape: { readings: [...], tags: [...] }
function flattenSpeedAnalysis(sa: any): {
  readings: Array<{ time: number; speed: number; direction: string }>;
  tags: Array<{ action: string; success: boolean; time: number }>;
} {
  if (!sa) return { readings: [], tags: [] };
  if (Array.isArray(sa?.periods)) {
    const readings: any[] = [];
    const tags: any[] = [];
    for (const p of sa.periods) {
      if (Array.isArray(p?.readings)) readings.push(...p.readings);
      if (Array.isArray(p?.tags)) tags.push(...p.tags);
    }
    return { readings, tags };
  }
  return {
    readings: Array.isArray(sa?.readings) ? sa.readings : [],
    tags: Array.isArray(sa?.tags) ? sa.tags : [],
  };
}

type ProgressRow = {
  sessionId: string;
  date: string;
  dateLabel: string;
  opponent: string;
  result: string;
  peakSpeed: number;
  avgSpeed: number;
  peakAdvance: number;
  peakRetreat: number;
};

async function loadProgressRows(athleteId: string): Promise<ProgressRow[]> {
  const { data: sess } = await supabase
    .from("sessions")
    .select("id, session_date")
    .eq("athlete_id", athleteId);
  const sessions = sess ?? [];
  if (!sessions.length) return [];
  const ids = sessions.map((s) => s.id);
  const { data: fsRows } = await supabase
    .from("fencing_sessions")
    .select("session_id, opponent, result, speed_analysis")
    .in("session_id", ids);
  console.log("[Progress] fetched fencing_sessions rows:", fsRows);
  const rows: ProgressRow[] = [];
  for (const fs of fsRows ?? []) {
    const { readings } = flattenSpeedAnalysis((fs as any)?.speed_analysis);
    if (!readings.length) continue;
    const s = sessions.find((x) => x.id === (fs as any).session_id);
    if (!s) continue;
    const speeds = readings.map((r) => r.speed);
    const adv = readings.filter((r) => r.direction === "advance").map((r) => r.speed);
    const ret = readings.filter((r) => r.direction === "retreat").map((r) => r.speed);
    rows.push({
      sessionId: s.id,
      date: s.session_date,
      dateLabel: format(new Date(s.session_date), "MMM d"),
      opponent: (fs as any).opponent ?? "—",
      result: (fs as any).result ?? "—",
      peakSpeed: speeds.length ? Math.max(...speeds) : 0,
      avgSpeed: speeds.length ? speeds.reduce((a, b) => a + b, 0) / speeds.length : 0,
      peakAdvance: adv.length ? Math.max(...adv) : 0,
      peakRetreat: ret.length ? Math.max(...ret) : 0,
    });
  }
  rows.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  return rows;
}

function ProgressCharts({ athleteId, sport }: { athleteId: string; sport: string }) {
  const q = useQuery({ queryKey: ["progress-rows", athleteId], queryFn: () => loadProgressRows(athleteId) });
  const rows = q.data ?? [];
  const [sortDesc, setSortDesc] = useState(true);
  const navigate = useNavigate();

  if (q.isLoading) {
    return <div className="surface p-6 text-sm text-[var(--text-secondary)]">Loading progress…</div>;
  }
  if (!rows.length) {
    return (
      <div className="surface p-8 text-center text-sm text-[var(--text-secondary)]">
        No sessions with speed analysis yet. Upload and analyze a session video to see progress trends.
      </div>
    );
  }

  const chartData = rows.map((r) => ({
    date: r.dateLabel,
    peakSpeed: Number(r.peakSpeed.toFixed(2)),
    avgSpeed: Number(r.avgSpeed.toFixed(2)),
    peakAdvance: Number(r.peakAdvance.toFixed(2)),
    peakRetreat: Number(r.peakRetreat.toFixed(2)),
  }));

  const sortedRows = [...rows].sort((a, b) =>
    sortDesc ? new Date(b.date).getTime() - new Date(a.date).getTime() : new Date(a.date).getTime() - new Date(b.date).getTime(),
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <TrendChart title="Peak Speed (m/s)" data={chartData} dataKey="peakSpeed" benchmark={ELITE_BENCHMARKS.peakSpeed} />
        <TrendChart title="Peak Advance (m/s)" data={chartData} dataKey="peakAdvance" benchmark={ELITE_BENCHMARKS.peakAdvance} />
        <TrendChart title="Avg Speed (m/s)" data={chartData} dataKey="avgSpeed" benchmark={ELITE_BENCHMARKS.avgSpeed} />
        <TrendChart title="Peak Retreat (m/s)" data={chartData} dataKey="peakRetreat" benchmark={ELITE_BENCHMARKS.peakRetreat} />
      </div>

      <div className="surface p-5">
        <div className="metric-label mb-3">Session comparison</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] text-left text-xs uppercase tracking-wide text-[var(--text-secondary)]">
                <th className="py-2 pr-3">
                  <button
                    onClick={() => setSortDesc((s) => !s)}
                    className="inline-flex items-center gap-1 hover:text-[var(--text-primary)]"
                  >
                    Date <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="py-2 pr-3">Opponent</th>
                <th className="py-2 pr-3">Result</th>
                <th className="py-2 pr-3 text-right">Peak speed</th>
                <th className="py-2 pr-3 text-right">Avg speed</th>
                <th className="py-2 pr-3 text-right">Peak advance</th>
                <th className="py-2 pr-3 text-right">Peak retreat</th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((r) => (
                <tr
                  key={r.sessionId}
                  onClick={() => navigate({ to: "/sessions/fencing/$id", params: { id: r.sessionId } })}
                  className="cursor-pointer border-b border-[var(--border-subtle)] last:border-0 hover:bg-[var(--bg-elevated)]"
                >
                  <td className="py-2 pr-3 whitespace-nowrap">{format(new Date(r.date), "MMM d, yyyy")}</td>
                  <td className="py-2 pr-3">{r.opponent}</td>
                  <td className="py-2 pr-3 capitalize">{r.result}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{r.peakSpeed.toFixed(2)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{r.avgSpeed.toFixed(2)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{r.peakAdvance.toFixed(2)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{r.peakRetreat.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function TrendChart({ title, data, dataKey, benchmark }: { title: string; data: any[]; dataKey: string; benchmark: number }) {
  return (
    <div className="surface p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="metric-label">{title}</div>
        <div className="flex items-center gap-3 text-[10px] text-[var(--text-secondary)]">
          <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: "var(--fencing)" }} />Athlete</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-3" style={{ background: "var(--accent)" }} />Elite benchmark</span>
        </div>
      </div>
      <div className="h-56">
        <ClientOnly fallback={<div className="h-full w-full animate-pulse rounded bg-[var(--bg-elevated)]" />}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: -10 }}>
              <CartesianGrid stroke="var(--border-subtle)" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: "var(--text-secondary)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "var(--text-secondary)", fontSize: 11 }} axisLine={false} tickLine={false} domain={["auto", "auto"]} />
              <Tooltip
                contentStyle={{
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border-default)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelStyle={{ color: "var(--text-secondary)" }}
              />
              <ReferenceLine y={benchmark} stroke="var(--accent)" strokeDasharray="4 4" strokeWidth={1.5} />
              <Line type="monotone" dataKey={dataKey} stroke="var(--fencing)" strokeWidth={2.5} dot={{ r: 3, fill: "var(--fencing)" }} />
            </LineChart>
          </ResponsiveContainer>
        </ClientOnly>
      </div>
    </div>
  );
}

// ============= Drills Tab =============

type AggregatedStats = {
  sessionCount: number;
  analyzedCount: number;
  avgPeakSpeed: number;
  avgAdvanceSpeed: number;
  avgRetreatSpeed: number;
  avgSpeed: number;
  actionSuccessRates: string;
  latestSessionDate: string | null;
};

async function loadAthleteAggregate(athleteId: string): Promise<{
  plan: AthleteDrillPlan | null;
  stats: AggregatedStats;
}> {
  const { data: athlete } = await supabase
    .from("athletes")
    .select("drill_plan")
    .eq("id", athleteId)
    .maybeSingle();
  const plan = ((athlete as any)?.drill_plan ?? null) as AthleteDrillPlan | null;

  const { data: sess } = await supabase
    .from("sessions")
    .select("id, session_date")
    .eq("athlete_id", athleteId);
  const sessionIds = (sess ?? []).map((s) => s.id);
  const latestSessionDate =
    (sess ?? []).map((s) => s.session_date).sort().slice(-1)[0] ?? null;

  let analyses: Array<{ readings: Array<{ time: number; speed: number; direction: string }>; tags: Array<{ action: string; success: boolean; time: number }> }> = [];
  if (sessionIds.length) {
    const { data: fsRows } = await supabase
      .from("fencing_sessions")
      .select("speed_analysis")
      .in("session_id", sessionIds);
    analyses = (fsRows ?? [])
      .map((r: any) => flattenSpeedAnalysis(r.speed_analysis))
      .filter((a) => a.readings.length);
  }

  const peakSpeeds: number[] = [];
  const advanceSpeeds: number[] = [];
  const retreatSpeeds: number[] = [];
  const allSpeeds: number[] = [];
  const tagGroups: Record<string, { total: number; success: number; successSpeed: number[]; failSpeed: number[] }> = {};

  for (const a of analyses) {
    const speeds = a.readings.map((r) => r.speed);
    if (speeds.length) {
      peakSpeeds.push(Math.max(...speeds));
      allSpeeds.push(...speeds);
    }
    const adv = a.readings.filter((r) => r.direction === "advance").map((r) => r.speed);
    if (adv.length) advanceSpeeds.push(Math.max(...adv));
    const ret = a.readings.filter((r) => r.direction === "retreat").map((r) => r.speed);
    if (ret.length) retreatSpeeds.push(Math.max(...ret));

    for (const t of a.tags ?? []) {
      const k = t.action;
      if (!tagGroups[k]) tagGroups[k] = { total: 0, success: 0, successSpeed: [], failSpeed: [] };
      tagGroups[k].total++;
      // find nearest reading speed
      const nearest = a.readings.length
        ? a.readings.reduce((best, r) => (Math.abs(r.speed) > Math.abs(best.speed) ? r : best), a.readings[0])
        : null;
      const sp = nearest?.speed ?? 0;
      if (t.success) {
        tagGroups[k].success++;
        tagGroups[k].successSpeed.push(sp);
      } else {
        tagGroups[k].failSpeed.push(sp);
      }
    }
  }

  const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);
  const actionSuccessRates = Object.entries(tagGroups)
    .map(([action, v]) => {
      const successPct = Math.round((v.success / v.total) * 100);
      const failPct = 100 - successPct;
      const successAvg = mean(v.successSpeed).toFixed(2);
      const failAvg = mean(v.failSpeed).toFixed(2);
      return `${action}: ${successPct}% success rate at avg ${successAvg} m/s, ${failPct}% fail rate at avg ${failAvg} m/s`;
    })
    .join("; ") || "no tagged actions";

  return {
    plan,
    stats: {
      sessionCount: sessionIds.length,
      analyzedCount: analyses.length,
      avgPeakSpeed: mean(peakSpeeds),
      avgAdvanceSpeed: mean(advanceSpeeds),
      avgRetreatSpeed: mean(retreatSpeeds),
      avgSpeed: mean(allSpeeds),
      actionSuccessRates,
      latestSessionDate,
    },
  };
}

function DrillsTab({ athleteId, athleteName, athleteAge }: { athleteId: string; athleteName: string; athleteAge: number | null }) {
  const generate = useServerFn(generateAthleteDrillPlan);
  const q = useQuery({
    queryKey: ["athlete-drills", athleteId],
    queryFn: () => loadAthleteAggregate(athleteId),
  });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [showCompleted, setShowCompleted] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [allowedKinds, setAllowedKinds] = useState<Record<DrillKind, boolean>>({ solo: true, partner: true, footwork: true });
  const [equipment, setEquipment] = useState("");
  const [focusArea, setFocusArea] = useState("");

  const plan = q.data?.plan ?? null;
  const stats = q.data?.stats;

  async function savePlan(next: AthleteDrillPlan) {
    await supabase.from("athletes").update({ drill_plan: next } as any).eq("id", athleteId);
    await q.refetch();
  }

  async function handleGenerate() {
    if (!stats) return;
    setLoading(true);
    setErr(null);
    setModalOpen(false);
    try {
      const kinds = (Object.keys(allowedKinds) as DrillKind[]).filter((k) => allowedKinds[k]);
      const result = await generate({
        data: {
          athleteName,
          athleteAge,
          sessionCount: stats.analyzedCount,
          avgPeakSpeed: stats.avgPeakSpeed,
          avgAdvanceSpeed: stats.avgAdvanceSpeed,
          avgRetreatSpeed: stats.avgRetreatSpeed,
          avgSpeed: stats.avgSpeed,
          actionSuccessRates: stats.actionSuccessRates,
          allowedKinds: kinds.length ? kinds : undefined,
          equipment: equipment.trim() || undefined,
          focusArea: focusArea.trim() || undefined,
        },
      });
      const next: AthleteDrillPlan = {
        ...result,
        completed: plan?.completed ?? {},
      };
      await savePlan(next);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to generate drill plan");
    } finally {
      setLoading(false);
    }
  }

  async function markComplete(drill: AthleteDrillPrescription) {
    if (!plan) return;
    const next: AthleteDrillPlan = {
      ...plan,
      drills: plan.drills.filter((d) => d.name !== drill.name),
      completed: {
        ...plan.completed,
        [drill.name]: { completedAt: new Date().toISOString(), drill },
      },
    };
    await savePlan(next);
  }

  async function unarchive(name: string) {
    if (!plan) return;
    const entry = plan.completed[name];
    if (!entry) return;
    const { [name]: _omit, ...rest } = plan.completed;
    const next: AthleteDrillPlan = {
      ...plan,
      drills: [...plan.drills, entry.drill].sort((a, b) => a.priority - b.priority),
      completed: rest,
    };
    await savePlan(next);
  }

  if (q.isLoading) {
    return <div className="surface p-10 text-center text-sm text-[var(--text-secondary)]">Loading…</div>;
  }

  const newSessionsSinceGen =
    plan && stats ? Math.max(0, stats.sessionCount - plan.sessionCountAtGeneration) : 0;
  const completedList = plan ? Object.entries(plan.completed) : [];

  return (
    <div className="space-y-4">
      <div className="surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="metric-label">Drill Plan</div>
            <h2 className="mt-1 text-lg font-semibold">Personalized training plan</h2>
            <div className="mt-2 space-y-0.5 text-xs text-[var(--text-secondary)]">
              {plan ? (
                <>
                  <div>Last generated: <span className="text-[var(--text-primary)]">{format(new Date(plan.generatedAt), "PPP")}</span></div>
                  <div>
                    Based on {plan.sessionCountAtGeneration} session{plan.sessionCountAtGeneration === 1 ? "" : "s"}.
                    {newSessionsSinceGen > 0 && (
                      <span className="ml-1 text-[var(--data-warning)]">
                        {newSessionsSinceGen} new session{newSessionsSinceGen === 1 ? "" : "s"} since last update.
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <div>
                  No drill plan yet. {stats?.analyzedCount ?? 0} session{stats?.analyzedCount === 1 ? "" : "s"} with speed analysis available.
                </div>
              )}
            </div>
          </div>
          <button
            onClick={() => setModalOpen(true)}
            disabled={loading || !stats || stats.analyzedCount === 0}
            className="inline-flex items-center gap-2 rounded-md bg-[var(--accent)] px-4 py-2 text-xs font-semibold text-black hover:opacity-90 disabled:opacity-50"
          >
            {plan ? <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> : <Sparkles className="h-3.5 w-3.5" />}
            {loading ? "Generating…" : plan ? "Regenerate" : "Generate Drill Plan"}
          </button>
        </div>
        {stats && stats.analyzedCount === 0 && (
          <div className="mt-3 text-xs text-[var(--text-secondary)]">
            Analyze at least one session video to enable drill generation.
          </div>
        )}
        {err && <div className="mt-3 text-xs text-[var(--data-negative)]">{err}</div>}
      </div>

      {loading && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="surface p-4">
              <div className="h-3 w-2/3 animate-pulse rounded bg-[var(--bg-elevated)]" />
              <div className="mt-3 h-2 w-1/2 animate-pulse rounded bg-[var(--bg-elevated)]" />
            </div>
          ))}
        </div>
      )}

      {plan && !loading && plan.drills.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {plan.drills.map((d) => {
            const isOpen = !!expanded[d.name];
            return (
              <div key={d.name} className="surface p-4" style={{ borderLeft: "4px solid var(--accent)" }}>
                <button
                  onClick={() => setExpanded((p) => ({ ...p, [d.name]: !isOpen }))}
                  className="flex w-full items-start justify-between gap-2 text-left"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-[var(--bg-elevated)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                        Priority {d.priority}
                      </span>
                      {(() => {
                        const kind = (d as { kind?: string }).kind ?? "solo";
                        const styles: Record<string, string> = {
                          solo: "bg-[color-mix(in_oklab,var(--accent)_18%,transparent)] text-[var(--accent)]",
                          partner: "bg-[color-mix(in_oklab,var(--data-positive)_18%,transparent)] text-[var(--data-positive)]",
                          footwork: "bg-[color-mix(in_oklab,var(--data-warning,#f59e0b)_18%,transparent)] text-[var(--data-warning,#f59e0b)]",
                        };
                        const label = kind === "partner" ? "Partner" : kind === "footwork" ? "Footwork" : "Solo";
                        return (
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${styles[kind] ?? styles.solo}`}>
                            {label}
                          </span>
                        );
                      })()}
                      <div className="text-sm font-semibold">{d.name}</div>
                    </div>
                    <div className="mt-1.5 text-[11px] text-[var(--text-secondary)]">{d.addresses}</div>
                    <div className="mt-1 text-[11px]"><span className="text-[var(--text-muted)]">Target:</span> <span className="text-[var(--text-primary)]">{d.target}</span></div>
                  </div>
                  <ChevronDown className={`h-4 w-4 shrink-0 text-[var(--text-secondary)] transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </button>

                {isOpen && (
                  <div className="mt-3 space-y-3 border-t border-[var(--border-subtle)] pt-3">
                    <div>
                      <div className="metric-label mb-1">Instructions</div>
                      <ol className="list-decimal space-y-1 pl-4 text-xs text-[var(--text-secondary)]">
                        {d.instructions.map((step, i) => <li key={i}>{step}</li>)}
                      </ol>
                    </div>
                    <div className="text-[11px] text-[var(--text-secondary)]">
                      Duration: <span className="text-[var(--text-primary)]">{d.duration}</span>
                    </div>
                    <button
                      onClick={() => markComplete(d)}
                      className="inline-flex items-center gap-1.5 rounded-md bg-[var(--data-positive)] px-3 py-1.5 text-xs font-medium text-black hover:opacity-90"
                    >
                      <Check className="h-3.5 w-3.5" /> Mark Complete
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {plan && plan.drills.length === 0 && !loading && (
        <div className="surface p-6 text-center text-sm text-[var(--text-secondary)]">
          All drills completed. Regenerate for a fresh plan based on new sessions.
        </div>
      )}

      {completedList.length > 0 && (
        <div className="surface">
          <button
            onClick={() => setShowCompleted((v) => !v)}
            className="flex w-full items-center justify-between px-5 py-3 text-left"
          >
            <span className="text-sm font-medium">
              Completed Drills <span className="text-[var(--text-secondary)]">({completedList.length})</span>
            </span>
            <ChevronDown className={`h-4 w-4 text-[var(--text-secondary)] transition-transform ${showCompleted ? "rotate-180" : ""}`} />
          </button>
          {showCompleted && (
            <ul className="divide-y divide-[var(--border-subtle)] border-t border-[var(--border-subtle)]">
              {completedList.map(([name, entry]) => (
                <li key={name} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 text-[var(--data-positive)]" />
                      <span className="text-sm font-medium">{name}</span>
                    </div>
                    <div className="mt-0.5 text-[11px] text-[var(--text-secondary)]">
                      Completed {format(new Date(entry.completedAt), "PP")}
                    </div>
                  </div>
                  <button
                    onClick={() => unarchive(name)}
                    className="text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  >
                    Restore
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="bg-[var(--bg-elevated)] border-[var(--border-default)] text-[var(--text-primary)]">
          <DialogHeader>
            <DialogTitle>Customize your drill plan</DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            <div>
              <div className="metric-label mb-2">Drill types</div>
              <div className="flex flex-wrap gap-4">
                {(["solo", "partner", "footwork"] as DrillKind[]).map((k) => (
                  <label key={k} className="flex cursor-pointer items-center gap-2 text-sm">
                    <Checkbox
                      checked={allowedKinds[k]}
                      onCheckedChange={(v) => setAllowedKinds((p) => ({ ...p, [k]: v === true }))}
                    />
                    <span className="capitalize">{k}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="equipment">Equipment available (optional)</Label>
              <Input
                id="equipment"
                value={equipment}
                onChange={(e) => setEquipment(e.target.value)}
                placeholder="e.g. resistance bands, cones, second fencer"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="focus">Focus area (optional)</Label>
              <Input
                id="focus"
                value={focusArea}
                onChange={(e) => setFocusArea(e.target.value)}
                placeholder="e.g. explosive lunge, distance management"
              />
            </div>
            <div className="flex justify-end pt-2">
              <button
                onClick={handleGenerate}
                disabled={!Object.values(allowedKinds).some(Boolean)}
                className="inline-flex items-center gap-2 rounded-md bg-[var(--accent)] px-4 py-2 text-xs font-semibold text-black hover:opacity-90 disabled:opacity-50"
              >
                <Sparkles className="h-3.5 w-3.5" /> Generate Drills
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============= Goals Tab =============

type GoalMetricKey = "peak_speed" | "avg_speed" | "peak_advance" | "peak_retreat" | "bout_win_rate";

const GOAL_METRICS: { key: GoalMetricKey; label: string; unit: string }[] = [
  { key: "peak_speed", label: "Peak Speed", unit: "m/s" },
  { key: "avg_speed", label: "Avg Speed", unit: "m/s" },
  { key: "peak_advance", label: "Peak Advance", unit: "m/s" },
  { key: "peak_retreat", label: "Peak Retreat", unit: "m/s" },
  { key: "bout_win_rate", label: "Bout Win Rate", unit: "%" },
];

async function loadGoalCurrents(athleteId: string): Promise<Record<GoalMetricKey, number>> {
  const { data: sess } = await supabase
    .from("sessions")
    .select("id")
    .eq("athlete_id", athleteId);
  const sessionIds = (sess ?? []).map((s) => s.id);
  const result: Record<GoalMetricKey, number> = {
    peak_speed: 0,
    avg_speed: 0,
    peak_advance: 0,
    peak_retreat: 0,
    bout_win_rate: 0,
  };
  if (!sessionIds.length) return result;

  const { data: fsRows } = await supabase
    .from("fencing_sessions")
    .select("speed_analysis, result")
    .in("session_id", sessionIds);
  const rows = fsRows ?? [];

  const peakSpeeds: number[] = [];
  const advanceSpeeds: number[] = [];
  const retreatSpeeds: number[] = [];
  const allSpeeds: number[] = [];

  for (const r of rows) {
    const { readings } = flattenSpeedAnalysis((r as any)?.speed_analysis);
    if (!readings.length) continue;
    const speeds = readings.map((x) => x.speed);
    peakSpeeds.push(Math.max(...speeds));
    allSpeeds.push(...speeds);
    const adv = readings.filter((x) => x.direction === "advance").map((x) => x.speed);
    if (adv.length) advanceSpeeds.push(Math.max(...adv));
    const ret = readings.filter((x) => x.direction === "retreat").map((x) => x.speed);
    if (ret.length) retreatSpeeds.push(Math.max(...ret));
  }
  const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);
  result.peak_speed = peakSpeeds.length ? Math.max(...peakSpeeds) : 0;
  result.avg_speed = mean(allSpeeds);
  result.peak_advance = advanceSpeeds.length ? Math.max(...advanceSpeeds) : 0;
  result.peak_retreat = retreatSpeeds.length ? Math.max(...retreatSpeeds) : 0;

  const withResult = rows.filter((r: any) => r.result === "win" || r.result === "loss");
  if (withResult.length) {
    const wins = withResult.filter((r: any) => r.result === "win").length;
    result.bout_win_rate = Math.round((wins / withResult.length) * 100);
  }
  return result;
}

function GoalsTab({ athleteId }: { athleteId: string }) {
  const goals = useQuery({ queryKey: ["goals", athleteId], queryFn: () => getGoals(athleteId) });
  const currents = useQuery({ queryKey: ["goal-currents", athleteId], queryFn: () => loadGoalCurrents(athleteId) });
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [metric, setMetric] = useState<GoalMetricKey>("peak_speed");
  const [target, setTarget] = useState("");
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function resetForm() {
    setEditingId(null);
    setMetric("peak_speed");
    setTarget("");
    setDate(undefined);
    setErr(null);
  }

  function openForCreate() {
    resetForm();
    setOpen(true);
  }

  function openForEdit(g: any) {
    const def = GOAL_METRICS.find((m) => m.label === g.metric_name);
    setEditingId(g.id);
    setMetric(def?.key ?? "peak_speed");
    setTarget(String(g.target_value ?? ""));
    setDate(g.target_date ? new Date(g.target_date) : undefined);
    setErr(null);
    setOpen(true);
  }

  async function saveGoal() {
    setErr(null);
    const targetNum = Number(target);
    if (!Number.isFinite(targetNum) || targetNum <= 0) {
      setErr("Enter a valid target value.");
      return;
    }
    const def = GOAL_METRICS.find((m) => m.key === metric)!;
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const userId = u.user?.id;
      if (!userId) throw new Error("Not authenticated");
      const cur = currents.data?.[metric] ?? 0;
      const targetDate = date ? format(date, "yyyy-MM-dd") : null;
      if (editingId) {
        const { error } = await supabase
          .from("athlete_goals")
          .update({
            metric_name: def.label,
            target_value: targetNum,
            current_value: cur,
            unit: def.unit,
            target_date: targetDate,
          })
          .eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("athlete_goals").insert({
          athlete_id: athleteId,
          user_id: userId,
          metric_name: def.label,
          target_value: targetNum,
          current_value: cur,
          unit: def.unit,
          target_date: targetDate,
        });
        if (error) throw error;
      }
      setOpen(false);
      resetForm();
      await goals.refetch();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to save goal");
    } finally {
      setSaving(false);
    }
  }

  async function deleteGoal(id: string) {
    if (!confirm("Delete this goal?")) return;
    setDeletingId(id);
    try {
      const { error } = await supabase.from("athlete_goals").delete().eq("id", id);
      if (error) throw error;
      await goals.refetch();
    } catch (e: any) {
      alert(e?.message ?? "Failed to delete goal");
    } finally {
      setDeletingId(null);
    }
  }

  function currentFor(metricName: string): number | null {
    const def = GOAL_METRICS.find((m) => m.label === metricName);
    if (!def || !currents.data) return null;
    return currents.data[def.key];
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm text-[var(--text-secondary)]">
          {goals.data?.length ?? 0} goal{(goals.data?.length ?? 0) === 1 ? "" : "s"}
        </div>
        <button
          onClick={openForCreate}
          className="inline-flex items-center gap-1.5 rounded-md bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-black hover:opacity-90"
        >
          <Plus className="h-3.5 w-3.5" /> Add Goal
        </button>
      </div>

      {goals.data?.length === 0 && (
        <div className="surface p-10 text-center">
          <div className="text-sm text-[var(--text-secondary)]">No goals set yet.</div>
          <button
            onClick={openForCreate}
            className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-black hover:opacity-90"
          >
            <Plus className="h-3.5 w-3.5" /> Add Goal
          </button>
        </div>
      )}

      {goals.data?.map((g: any) => {
        const live = currentFor(g.metric_name);
        const current = live ?? Number(g.current_value ?? 0);
        const pct = g.target_value ? Math.min(100, Math.round((current / Number(g.target_value)) * 100)) : 0;
        return (
          <div key={g.id} className="surface p-5">
            <div className="flex items-baseline justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold capitalize">{g.metric_name}</div>
                <div className="text-xs text-[var(--text-secondary)]">
                  Target: {g.target_value}{g.unit ? ` ${g.unit}` : ""} {g.target_date ? `· by ${format(new Date(g.target_date), "PP")}` : ""}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-sm font-medium">{Number.isFinite(current) ? current.toFixed(current < 10 ? 2 : 0) : "—"}{g.unit ? ` ${g.unit}` : ""}</div>
                  <div className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">current</div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openForEdit(g)}
                    aria-label="Edit goal"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => deleteGoal(g.id)}
                    disabled={deletingId === g.id}
                    aria-label="Delete goal"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--data-negative)] disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--bg-elevated)]">
              <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
        <DialogContent className="bg-[var(--bg-elevated)] border-[var(--border-default)] text-[var(--text-primary)]">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Goal" : "Add Goal"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            <div className="space-y-1.5">
              <Label>Metric</Label>
              <Select value={metric} onValueChange={(v) => setMetric(v as GoalMetricKey)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GOAL_METRICS.map((m) => (
                    <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="target">Target value ({GOAL_METRICS.find((m) => m.key === metric)?.unit})</Label>
              <Input
                id="target"
                type="number"
                inputMode="decimal"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="e.g. 4.0"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Target date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
            {err && <div className="text-xs text-[var(--data-negative)]">{err}</div>}
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => { setOpen(false); resetForm(); }}
                className="rounded-md px-3 py-2 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                Cancel
              </button>
              <button
                onClick={saveGoal}
                disabled={saving || !target}
                className="inline-flex items-center gap-2 rounded-md bg-[var(--accent)] px-4 py-2 text-xs font-semibold text-black hover:opacity-90 disabled:opacity-50"
              >
                {saving ? "Saving…" : editingId ? "Save Changes" : "Save Goal"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============= Benchmarks Tab =============

type BenchPt = { x: number; y: number };
type BenchReading = { time: number; speed: number; direction: "advance" | "retreat" };
type BenchFrame = { time: number; nx: number; ny: number; detected: boolean };
type BenchActionType = "Attack" | "Lunge" | "Parry" | "Riposte" | "Advance" | "Retreat" | "Touch";
type BenchActionTag = { id: string; time: number; action: BenchActionType; success: boolean };
type BenchAnalysis = {
  readings: BenchReading[];
  duration: number;
  points: BenchPt[];
  videoPath?: string | null;
  tags?: BenchActionTag[];
};

const BENCH_ACTION_TYPES: BenchActionType[] = ["Attack", "Lunge", "Parry", "Riposte", "Advance", "Retreat", "Touch"];
const BENCH_ACTION_COLORS: Record<BenchActionType, string> = {
  Attack: "#ef4444",
  Lunge: "#f97316",
  Parry: "#3b82f6",
  Riposte: "#06b6d4",
  Advance: "#22c55e",
  Retreat: "#ec4899",
  Touch: "#eab308",
};

const BENCHMARK_COLOR = "#f59e0b";
const RIE_COLOR = "var(--fencing)";

const UNSUPPORTED_VIDEO_MESSAGE =
  "Video format not supported. Please convert to MP4 and try again, or use QuickTime Player → Export As → 1080p to convert on Mac.";

function attachVideoSources(v: HTMLVideoElement, url: string) {
  // Set src as fallback, and add explicit <source> children so the browser
  // can pick the first supported MIME (mp4 / quicktime for .mov files).
  v.src = url;
  const mp4 = document.createElement("source");
  mp4.src = url;
  mp4.type = "video/mp4";
  const mov = document.createElement("source");
  mov.src = url;
  mov.type = "video/quicktime";
  v.appendChild(mp4);
  v.appendChild(mov);
}

function benchUid() {
  return (typeof crypto !== "undefined" && (crypto as any).randomUUID?.()) || `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function extractBenchFirstFrame(url: string): Promise<{ frame: string; dur: number }> {
  return new Promise((resolve, reject) => {
    const v = document.createElement("video");
    v.preload = "auto";
    v.muted = true;
    v.playsInline = true;
    v.crossOrigin = "anonymous";
    v.addEventListener("loadeddata", () => { v.currentTime = 0.05; });
    v.addEventListener("seeked", () => {
      const c = document.createElement("canvas");
      c.width = v.videoWidth;
      c.height = v.videoHeight;
      const ctx = c.getContext("2d");
      if (!ctx) return reject(new Error("Canvas 2D unavailable"));
      ctx.drawImage(v, 0, 0);
      resolve({ frame: c.toDataURL("image/jpeg", 0.9), dur: v.duration });
    }, { once: true });
    v.addEventListener("error", () => reject(new Error(UNSUPPORTED_VIDEO_MESSAGE)));
    attachVideoSources(v, url);
  });
}

async function aggregateAthleteStats(athleteId: string) {
  const { data: sess } = await supabase.from("sessions").select("id").eq("athlete_id", athleteId);
  const sessionIds = (sess ?? []).map((s) => s.id);
  const result = {
    peakSpeed: 0,
    avgSpeed: 0,
    peakAdvance: 0,
    peakRetreat: 0,
    readings: [] as BenchReading[],
    actionAvgSpeeds: {} as Record<string, number>,
  };
  if (!sessionIds.length) return result;
  const { data: fsRows } = await supabase
    .from("fencing_sessions")
    .select("speed_analysis")
    .in("session_id", sessionIds);
  const peaks: number[] = [];
  const advPeaks: number[] = [];
  const retPeaks: number[] = [];
  const all: number[] = [];
  const allReadings: BenchReading[] = [];
  const actionSpeeds: Record<string, number[]> = {};
  console.log("[Benchmarks] aggregateAthleteStats fsRows:", fsRows);
  for (const r of (fsRows ?? []) as any[]) {
    const { readings, tags } = flattenSpeedAnalysis(r?.speed_analysis);
    if (!readings.length) continue;
    const speeds = readings.map((x) => x.speed);
    peaks.push(Math.max(...speeds));
    all.push(...speeds);
    const adv = readings.filter((x) => x.direction === "advance").map((x) => x.speed);
    if (adv.length) advPeaks.push(Math.max(...adv));
    const ret = readings.filter((x) => x.direction === "retreat").map((x) => x.speed);
    if (ret.length) retPeaks.push(Math.max(...ret));
    allReadings.push(...(readings as BenchReading[]));
    if (tags.length) {
      for (const tg of tags) {
        const window = readings.filter((rd) => rd.time >= tg.time && rd.time <= tg.time + 1.0);
        if (window.length) {
          const best = window.reduce((max, rd) => (rd.speed > max.speed ? rd : max), window[0]);
          (actionSpeeds[tg.action] ||= []).push(best.speed);
        } else if (readings.length) {
          let best = readings[0];
          let bestDiff = Math.abs(best.time - tg.time);
          for (const rd of readings) {
            const d = Math.abs(rd.time - tg.time);
            if (d < bestDiff) { best = rd; bestDiff = d; }
          }
          (actionSpeeds[tg.action] ||= []).push(best.speed);
        }
      }
    }
  }
  console.log("[Benchmarks] aggregated readings count:", allReadings.length);
  const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);
  result.peakSpeed = mean(peaks);
  result.avgSpeed = mean(all);
  result.peakAdvance = mean(advPeaks);
  result.peakRetreat = mean(retPeaks);
  result.readings = allReadings;
  result.actionAvgSpeeds = Object.fromEntries(
    Object.entries(actionSpeeds).map(([k, v]) => [k, mean(v)]),
  );
  return result;
}

function statsFromReadings(readings: BenchReading[]) {
  if (!readings.length) return { peakSpeed: 0, avgSpeed: 0, peakAdvance: 0, peakRetreat: 0 };
  const speeds = readings.map((r) => r.speed);
  const adv = readings.filter((r) => r.direction === "advance").map((r) => r.speed);
  const ret = readings.filter((r) => r.direction === "retreat").map((r) => r.speed);
  const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);
  return {
    peakSpeed: Math.max(...speeds),
    avgSpeed: mean(speeds),
    peakAdvance: adv.length ? Math.max(...adv) : 0,
    peakRetreat: ret.length ? Math.max(...ret) : 0,
  };
}

function actionAvgFromAnalysis(readings: BenchReading[], tags: BenchActionTag[] | undefined): Record<string, number> {
  if (!tags?.length || !readings.length) return {};
  const speeds: Record<string, number[]> = {};
  for (const tg of tags) {
    const window = readings.filter((r) => r.time >= tg.time && r.time <= tg.time + 1.0);
    if (window.length) {
      const best = window.reduce((max, r) => (r.speed > max.speed ? r : max), window[0]);
      (speeds[tg.action] ||= []).push(best.speed);
    } else {
      let best = readings[0];
      let bestDiff = Math.abs(best.time - tg.time);
      for (const r of readings) {
        const d = Math.abs(r.time - tg.time);
        if (d < bestDiff) { best = r; bestDiff = d; }
      }
      (speeds[tg.action] ||= []).push(best.speed);
    }
  }
  const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
  return Object.fromEntries(Object.entries(speeds).map(([k, v]) => [k, mean(v)]));
}

// Bin readings into N evenly-spaced buckets across normalized 0..100% timeline
function binReadings(readings: BenchReading[], bins = 20): { t: number; speed: number }[] {
  if (!readings.length) return [];
  const tMax = Math.max(...readings.map((r) => r.time));
  const tMin = Math.min(...readings.map((r) => r.time));
  const span = tMax - tMin || 1;
  const buckets: number[][] = Array.from({ length: bins }, () => []);
  for (const r of readings) {
    const idx = Math.min(bins - 1, Math.floor(((r.time - tMin) / span) * bins));
    buckets[idx].push(r.speed);
  }
  return buckets.map((b, i) => ({
    t: Math.round((i / (bins - 1)) * 100),
    speed: b.length ? b.reduce((s, x) => s + x, 0) / b.length : 0,
  }));
}

// Bin readings into N evenly-spaced time buckets keyed by absolute seconds
function binByTime(readings: BenchReading[], bins = 30): { t: number; speed: number }[] {
  if (!readings.length) return [];
  const tMax = Math.max(...readings.map((r) => r.time));
  const tMin = Math.min(...readings.map((r) => r.time));
  const span = tMax - tMin || 1;
  const buckets: number[][] = Array.from({ length: bins }, () => []);
  for (const r of readings) {
    const idx = Math.min(bins - 1, Math.floor(((r.time - tMin) / span) * bins));
    buckets[idx].push(r.speed);
  }
  return buckets.map((b, i) => ({
    t: +(tMin + (i / (bins - 1)) * span).toFixed(1),
    speed: b.length ? +(b.reduce((s, x) => s + x, 0) / b.length).toFixed(2) : 0,
  }));
}

// ============= Clip-library types & helpers =============

type ClipAction = "Lunge" | "Attack" | "Retreat" | "Advance" | "Parry" | "Riposte" | "General";
const CLIP_ACTIONS: ClipAction[] = ["Lunge", "Attack", "Retreat", "Advance", "Parry", "Riposte", "General"];
const CLIP_ACTION_COLORS: Record<ClipAction, string> = {
  Lunge: "#f97316",
  Attack: "#ef4444",
  Retreat: "#ec4899",
  Advance: "#22c55e",
  Parry: "#3b82f6",
  Riposte: "#06b6d4",
  General: "#94a3b8",
};

type BenchClip = {
  id: string;
  action: ClipAction;
  videoPath: string | null;
  thumbnail: string | null;
  createdAt: string;
  duration: number;
  points: BenchPt[];
  readings: BenchReading[];
  tags: BenchActionTag[];
  peakSpeed: number;
  avgSpeed: number;
};

type BenchFencer = { id: string; name: string; notes: string | null; clips: BenchClip[] };

function normalizeBenchmark(row: any): BenchFencer {
  const sa = row?.speed_analysis;
  let clips: BenchClip[] = [];
  if (Array.isArray(sa?.clips)) {
    clips = (sa.clips as BenchClip[]).map((c) => ({
      ...c,
      tags: Array.isArray(c?.tags) ? c.tags : [],
      readings: Array.isArray(c?.readings) ? c.readings : [],
      points: Array.isArray(c?.points) ? c.points : [],
    }));
  } else if (sa && (Array.isArray(sa?.readings) || Array.isArray(sa?.periods))) {
    // Legacy single-analysis shape → synthesize one "General" clip
    let readings: BenchReading[] = [];
    let tags: BenchActionTag[] = [];
    if (Array.isArray(sa.periods)) {
      for (const p of sa.periods) {
        if (Array.isArray(p?.readings)) readings.push(...p.readings);
        if (Array.isArray(p?.tags)) tags.push(...p.tags);
      }
    } else {
      readings = Array.isArray(sa.readings) ? sa.readings : [];
      tags = Array.isArray(sa.tags) ? sa.tags : [];
    }
    const speeds = readings.map((r) => r.speed);
    if (readings.length || sa.videoPath) {
      clips = [{
        id: `${row.id}-legacy`,
        action: "General",
        videoPath: sa.videoPath ?? null,
        thumbnail: null,
        createdAt: row.created_at ?? new Date().toISOString(),
        duration: Number(sa.duration) || 0,
        points: Array.isArray(sa.points) ? sa.points : [],
        readings,
        tags,
        peakSpeed: speeds.length ? Math.max(...speeds) : 0,
        avgSpeed: speeds.length ? speeds.reduce((s, x) => s + x, 0) / speeds.length : 0,
      }];
    }
  }
  return {
    id: row.id,
    name: row.name ?? "Untitled Benchmark",
    notes: row.notes ?? null,
    clips,
  };
}

function allReadingsFromClips(clips: BenchClip[]): BenchReading[] {
  const out: BenchReading[] = [];
  for (const c of clips) out.push(...(c.readings ?? []));
  return out;
}

// Avg speed per action for a benchmark fencer, combining:
// - explicit per-action clips (contributing each clip's avgSpeed)
// - tag samples from "General" clips (instantaneous speed at the tag)
function actionAvgFromClips(clips: BenchClip[]): Record<string, number> {
  const buckets: Record<string, number[]> = {};
  for (const c of clips) {
    if (c.action !== "General" && c.avgSpeed > 0) {
      (buckets[c.action] ||= []).push(c.avgSpeed);
    }
    if (c.tags?.length && c.readings?.length) {
      for (const tg of c.tags) {
        const window = c.readings.filter((r) => r.time >= tg.time && r.time <= tg.time + 1.0);
        if (window.length) {
          const best = window.reduce((max, r) => (r.speed > max.speed ? r : max), window[0]);
          (buckets[tg.action] ||= []).push(best.speed);
        } else {
          let best = c.readings[0];
          let bestDiff = Math.abs(best.time - tg.time);
          for (const r of c.readings) {
            const d = Math.abs(r.time - tg.time);
            if (d < bestDiff) { best = r; bestDiff = d; }
          }
          (buckets[tg.action] ||= []).push(best.speed);
        }
      }
    }
  }
  const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
  return Object.fromEntries(Object.entries(buckets).map(([k, v]) => [k, mean(v)]));
}

async function makeThumbnail(dataUrl: string, maxW = 320): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxW / img.width);
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      const ctx = c.getContext("2d");
      if (!ctx) { resolve(dataUrl); return; }
      ctx.drawImage(img, 0, 0, w, h);
      resolve(c.toDataURL("image/jpeg", 0.7));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

// ============= Benchmarks Tab =============

function BenchmarksTab({ athleteId, athleteName }: { athleteId: string; athleteName: string }) {
  const benchmarks = useQuery({
    queryKey: ["athlete-benchmarks-records", athleteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("benchmarks" as any)
        .select("*")
        .eq("athlete_id", athleteId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
  const athleteStats = useQuery({
    queryKey: ["athlete-aggregate-stats", athleteId],
    queryFn: () => aggregateAthleteStats(athleteId),
  });

  const list: BenchFencer[] = (benchmarks.data ?? []).map(normalizeBenchmark);

  async function addBenchmark() {
    const { data: u } = await supabase.auth.getUser();
    const userId = u.user?.id;
    if (!userId) return;
    const defaultName = list.length === 0 ? "Benchmark Fencer" : `Benchmark ${list.length + 1}`;
    const { error } = await supabase.from("benchmarks" as any).insert({
      athlete_id: athleteId,
      user_id: userId,
      name: defaultName,
    });
    if (error) { alert(error.message); return; }
    await benchmarks.refetch();
  }

  const primary = list.find((b) => b.clips.length > 0) ?? null;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Benchmarks</h2>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            Build a library of short, action-specific clips per benchmark fencer to compare against {athleteName || "this athlete"}.
          </p>
        </div>
        <button
          onClick={addBenchmark}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-black hover:opacity-90"
        >
          <Plus className="h-3.5 w-3.5" /> Add Benchmark Fencer
        </button>
      </div>

      {list.length === 0 && (
        <div className="surface p-10 text-center">
          <div className="text-sm text-[var(--text-secondary)]">No benchmark fencers yet.</div>
          <button
            onClick={addBenchmark}
            className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-black hover:opacity-90"
          >
            <Plus className="h-3.5 w-3.5" /> Add First Benchmark
          </button>
        </div>
      )}

      {list.map((b) => (
        <BenchmarkFencerCard key={b.id} fencer={b} onUpdated={() => benchmarks.refetch()} />
      ))}

      {primary && athleteStats.data && (
        <ComparisonSection
          athleteName={athleteName}
          athleteStats={athleteStats.data}
          fencer={primary}
        />
      )}
    </div>
  );
}

function BenchmarkFencerCard({ fencer, onUpdated }: { fencer: BenchFencer; onUpdated: () => void }) {
  const [open, setOpen] = useState(true);
  const [name, setName] = useState(fencer.name);
  const [notes, setNotes] = useState(fencer.notes ?? "");
  const [savingMeta, setSavingMeta] = useState(false);
  const [adding, setAdding] = useState(false);
  const [openClipId, setOpenClipId] = useState<string | null>(null);

  async function saveMeta() {
    setSavingMeta(true);
    try {
      await supabase
        .from("benchmarks" as any)
        .update({ name: name.trim() || "Untitled Benchmark", notes: notes.trim() || null })
        .eq("id", fencer.id);
      onUpdated();
    } finally { setSavingMeta(false); }
  }
  async function deleteFencer() {
    if (!confirm("Delete this benchmark fencer and all their clips?")) return;
    await supabase.from("benchmarks" as any).delete().eq("id", fencer.id);
    onUpdated();
  }
  async function persistClips(nextClips: BenchClip[]) {
    await supabase
      .from("benchmarks" as any)
      .update({ speed_analysis: { clips: nextClips } })
      .eq("id", fencer.id);
    onUpdated();
  }
  async function deleteClip(clipId: string) {
    if (!confirm("Delete this clip?")) return;
    await persistClips(fencer.clips.filter((c) => c.id !== clipId));
  }
  async function appendClip(clip: BenchClip) {
    await persistClips([...fencer.clips, clip]);
    setAdding(false);
  }
  async function updateClipTags(clipId: string, tags: BenchActionTag[]) {
    await persistClips(fencer.clips.map((c) => (c.id === clipId ? { ...c, tags } : c)));
  }

  const openClip = fencer.clips.find((c) => c.id === openClipId) ?? null;

  return (
    <div className="surface overflow-hidden" style={{ borderLeft: `4px solid ${BENCHMARK_COLOR}` }}>
      <div className="flex items-start gap-3 border-b border-[var(--border-subtle)] p-5">
        <button
          onClick={() => setOpen((o) => !o)}
          className="mt-1 inline-flex h-6 w-6 items-center justify-center rounded hover:bg-[var(--bg-elevated)]"
          aria-label={open ? "Collapse" : "Expand"}
        >
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        <div className="flex-1 space-y-2">
          <div className="metric-label">
            Benchmark Fencer · {fencer.clips.length} clip{fencer.clips.length === 1 ? "" : "s"}
          </div>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={saveMeta}
            placeholder='e.g. "Koki Kano"'
            className="font-semibold"
          />
          <Input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={saveMeta}
            placeholder="Notes (optional)"
          />
          {savingMeta && <div className="text-[10px] text-[var(--text-muted)]">Saving…</div>}
        </div>
        <button
          onClick={deleteFencer}
          title="Delete benchmark fencer"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--data-negative)]"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {open && (
        <div className="space-y-5 p-5">
          {fencer.clips.length === 0 && !adding && (
            <div className="rounded-md border border-dashed border-[var(--border-default)] p-6 text-center text-sm text-[var(--text-secondary)]">
              No clips yet. Add a short action-specific clip to start this fencer's library.
            </div>
          )}

          {fencer.clips.length > 0 && (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
              {fencer.clips.map((c) => (
                <div
                  key={c.id}
                  className="group surface cursor-pointer overflow-hidden text-left transition-colors hover:border-[var(--accent)]"
                  onClick={() => setOpenClipId(c.id)}
                >
                  <div className="relative aspect-video bg-black">
                    {c.thumbnail ? (
                      <img src={c.thumbnail} alt={c.action} className="h-full w-full object-cover" />
                    ) : (
                      <div className="grid h-full w-full place-items-center text-xs text-[var(--text-muted)]">No preview</div>
                    )}
                    <span
                      className="absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-semibold text-black"
                      style={{ background: CLIP_ACTION_COLORS[c.action] }}
                    >
                      {c.action}
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); void deleteClip(c.id); }}
                      className="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-md bg-black/50 text-white opacity-0 transition group-hover:opacity-100 hover:bg-[var(--data-negative)]"
                      aria-label="Delete clip"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="space-y-1 p-3">
                    <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                      <span>Peak</span><span>Avg</span>
                    </div>
                    <div className="flex items-center justify-between text-sm font-semibold tabular-nums">
                      <span style={{ color: BENCHMARK_COLOR }}>{c.peakSpeed.toFixed(2)} m/s</span>
                      <span className="text-[var(--text-secondary)]">{c.avgSpeed.toFixed(2)}</span>
                    </div>
                    {c.duration > 0 && (
                      <div className="text-[10px] text-[var(--text-muted)]">{c.duration.toFixed(1)}s</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {!adding && (
            <button
              onClick={() => setAdding(true)}
              className="inline-flex items-center gap-1.5 rounded-md bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-black hover:opacity-90"
            >
              <Plus className="h-3.5 w-3.5" /> Add Clip
            </button>
          )}

          {adding && (
            <ClipAnalyzer
              fencerId={fencer.id}
              onCancel={() => setAdding(false)}
              onComplete={appendClip}
            />
          )}

          {openClip && (
            <ClipPlayerDialog
              clip={openClip}
              onClose={() => setOpenClipId(null)}
              onTagsChanged={(tags) => updateClipTags(openClip.id, tags)}
            />
          )}
        </div>
      )}
    </div>
  );
}

function ClipAnalyzer({
  fencerId,
  onCancel,
  onComplete,
}: {
  fencerId: string;
  onCancel: () => void;
  onComplete: (clip: BenchClip) => Promise<void> | void;
}) {
  type Stage = "choose" | "upload" | "uploading" | "extracting" | "calibrate" | "select" | "analyzing" | "done";
  const [stage, setStage] = useState<Stage>("choose");
  const [action, setAction] = useState<ClipAction>("Lunge");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [firstFrame, setFirstFrame] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [points, setPoints] = useState<BenchPt[]>([]);
  const [progress, setProgress] = useState({ cur: 0, total: 0 });
  const [uploadedPath, setUploadedPath] = useState<string | null>(null);
  const [uploadedClipId, setUploadedClipId] = useState<string | null>(null);
  const [uploadPct, setUploadPct] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  async function onFile(file: File) {
    setError(null);
    const isMov = /\.mov$/i.test(file.name) || file.type === "video/quicktime";
    setWarning(isMov ? "MOV files may not be supported. Convert to MP4 if upload fails." : null);
    setPendingFile(file);
    setStage("uploading");
    setUploadPct(0);
    try {
      const { data: u } = await supabase.auth.getUser();
      const userId = u.user?.id;
      if (!userId) throw new Error("Not signed in");
      const clipId = benchUid();
      const ext = (file.name.split(".").pop() || "mp4").toLowerCase();
      const path = `${userId}/benchmarks/${fencerId}/${clipId}.${ext}`;
      const { publicUrl } = await uploadVideoToStorage(file, path, setUploadPct);
      setUploadedClipId(clipId);
      setUploadedPath(path);
      setDataUrl(publicUrl);
      setStage("extracting");
      const { frame, dur } = await extractBenchFirstFrame(publicUrl);
      setFirstFrame(frame);
      setDuration(dur);
      setPoints([]);
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
    if (next.length === 2) setStage("select");
  }


  async function runAnalysis(seedHip: HipPoint | null) {
    if (!dataUrl || points.length < 2) return;
    setStage("analyzing");
    setError(null);
    try {
      const v = document.createElement("video");
      v.muted = true; v.playsInline = true;
      v.crossOrigin = "anonymous";
      await new Promise<void>((res, rej) => {
        v.addEventListener("loadeddata", () => res(), { once: true });
        v.addEventListener("error", () => rej(new Error(UNSUPPORTED_VIDEO_MESSAGE)), { once: true });
        attachVideoSources(v, dataUrl);
      });
      const c = document.createElement("canvas");
      c.width = v.videoWidth; c.height = v.videoHeight;
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
        numPoses: 6,
      });
      const step = 0.25;
      const times: number[] = [];
      for (let t = 0; t < v.duration; t += step) times.push(t);
      setProgress({ cur: 0, total: times.length });
      const frames: BenchFrame[] = [];
      let lastHip: HipPoint | null = seedHip;
      for (let i = 0; i < times.length; i++) {
        const t = times[i];
        await new Promise<void>((res) => {
          v.addEventListener("seeked", () => res(), { once: true });
          v.currentTime = t;
        });
        ctx.drawImage(v, 0, 0);
        try {
          const result = poseLandmarker.detectForVideo(c, Math.round(t * 1000));
          const picked = pickClosestHip(result.landmarks as any, lastHip);
          if (picked) {
            lastHip = picked;
            frames.push({ time: t, nx: picked.nx, ny: picked.ny, detected: true });
          } else {
            frames.push({ time: t, nx: 0, ny: 0, detected: false });
          }
        } catch {
          frames.push({ time: t, nx: 0, ny: 0, detected: false });
        }
        setProgress({ cur: i + 1, total: times.length });
      }
      poseLandmarker.close();

      const W = v.videoWidth, H = v.videoHeight;
      const p0 = { x: points[0].x * W, y: points[0].y * H };
      const p1 = { x: points[1].x * W, y: points[1].y * H };
      const axis = { x: p1.x - p0.x, y: p1.y - p0.y };
      const axisLen = Math.hypot(axis.x, axis.y);
      const ux = axis.x / axisLen, uy = axis.y / axisLen;
      const mPerPx = 14 / axisLen;
      const out: BenchReading[] = [];
      const detected = frames.filter((f) => f.detected);
      for (let i = 1; i < detected.length; i++) {
        const a = detected[i - 1], b = detected[i];
        const dx = (b.nx - a.nx) * W, dy = (b.ny - a.ny) * H;
        const proj = dx * ux + dy * uy;
        const dt = b.time - a.time;
        if (dt <= 0) continue;
        const speed = Math.abs(proj * mPerPx) / dt;
        if (speed < 0.05 || speed > 10) continue;
        out.push({ time: b.time, speed, direction: proj >= 0 ? "advance" : "retreat" });
      }

      const speeds = out.map((r) => r.speed);
      const clipId = uploadedClipId ?? benchUid();
      const videoPath: string | null = uploadedPath;
      const thumb = firstFrame ? await makeThumbnail(firstFrame, 320) : null;
      const clip: BenchClip = {
        id: clipId,
        action,
        videoPath,
        thumbnail: thumb,
        createdAt: new Date().toISOString(),
        duration: v.duration,
        points,
        readings: out,
        tags: [],
        peakSpeed: speeds.length ? Math.max(...speeds) : 0,
        avgSpeed: speeds.length ? speeds.reduce((s, x) => s + x, 0) / speeds.length : 0,
      };
      setStage("done");
      await onComplete(clip);
    } catch (e: any) {
      setError(e?.message ?? "Analysis failed");
      setStage("calibrate");
    }
  }

  return (
    <div className="surface space-y-4 p-5">
      <div className="flex items-center justify-between">
        <div className="metric-label">Add Clip</div>
        <button onClick={onCancel} className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]">Cancel</button>
      </div>
      {error && (
        <div className="rounded-md border border-[var(--data-negative)]/40 bg-[var(--data-negative)]/10 p-3 text-sm text-[var(--data-negative)]">{error}</div>
      )}
      {warning && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-500">{warning}</div>
      )}

      {stage === "choose" && (
        <div className="space-y-3">
          <Label className="text-xs text-[var(--text-secondary)]">Action type</Label>
          <Select value={action} onValueChange={(v) => setAction(v as ClipAction)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {CLIP_ACTIONS.map((a) => (<SelectItem key={a} value={a}>{a}</SelectItem>))}
            </SelectContent>
          </Select>
          <button
            onClick={() => setStage("upload")}
            className="inline-flex items-center gap-1.5 rounded-md bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-black hover:opacity-90"
          >
            Continue
          </button>
        </div>
      )}

      {stage === "upload" && (
        <label
          className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-md border-2 border-dashed border-[var(--border-default)] p-10 text-center transition-colors hover:border-[var(--accent)]"
        >
          <Upload className="h-7 w-7 text-[var(--text-secondary)]" />
          <div className="text-sm font-medium">Upload {action} clip</div>
          <div className="text-xs text-[var(--text-secondary)]">Any size supported — video uploads directly to secure storage.</div>
          <div className="text-xs text-[var(--text-secondary)]">MP4 recommended.</div>
          <input
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
          />
        </label>
      )}

      {stage === "uploading" && (
        <div className="space-y-3 p-6">
          <div className="text-sm font-medium">Uploading video… {uploadPct}%</div>
          <Progress value={uploadPct} />
          <div className="text-xs text-[var(--text-secondary)]">Streaming directly to secure storage — large files OK.</div>
        </div>
      )}

      {stage === "extracting" && (
        <div className="grid place-items-center p-12 text-sm text-[var(--text-secondary)]">Extracting first frame…</div>
      )}

      {stage === "calibrate" && firstFrame && (
        <div>
          <div className="metric-label mb-2">Calibrate the piste</div>
          <p className="mb-4 text-xs text-[var(--text-secondary)]">
            Click the <span style={{ color: "var(--accent)" }}>0m end</span>, then the{" "}
            <span style={{ color: BENCHMARK_COLOR }}>14m end</span>. Duration: {duration.toFixed(1)}s.
          </p>
          <div style={{ position: "relative", display: "inline-block", maxWidth: "100%" }}>
            <img
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
                  background: i === 0 ? "var(--accent)" : BENCHMARK_COLOR,
                  border: "2px solid white",
                  transform: "translate(-50%, -50%)",
                  pointerEvents: "none",
                  boxShadow: "0 0 10px rgba(0,0,0,0.5)",
                }}
              />
            ))}
          </div>
          <div className="mt-4 flex gap-3">
            <button onClick={() => setPoints([])} className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-default)] px-3 py-1.5 text-xs hover:bg-[var(--bg-elevated)]">
              <RotateCcw className="h-3.5 w-3.5" /> Reset
            </button>
            {points.length === 2 && (
              <div className="self-center text-xs text-[var(--text-secondary)]">Calibration set — detecting athletes…</div>
            )}
          </div>
        </div>
      )}

      {stage === "select" && firstFrame && (
        <AthleteSelector
          firstFrame={firstFrame}
          onBack={() => setStage("calibrate")}
          onConfirm={(hip: HipPoint | null) => runAnalysis(hip)}
          confirmLabel="Confirm — Analyze Clip"
        />
      )}

      {stage === "analyzing" && (
        <div className="p-6 text-center text-sm text-[var(--text-secondary)]">
          Analyzing pose… {progress.cur}/{progress.total} frames
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--bg-elevated)]">
            <div
              className="h-full bg-[var(--accent)] transition-all"
              style={{ width: `${progress.total ? (progress.cur / progress.total) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {stage === "done" && (
        <div className="grid place-items-center p-6 text-sm text-[var(--text-secondary)]">Saving clip…</div>
      )}
    </div>
  );
}

function ClipPlayerDialog({
  clip,
  onClose,
  onTagsChanged,
}: {
  clip: BenchClip;
  onClose: () => void;
  onTagsChanged: (tags: BenchActionTag[]) => void;
}) {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [tags, setTags] = useState<BenchActionTag[]>(clip.tags ?? []);
  const [pendingTag, setPendingTag] = useState<{ action: BenchActionType; time: number } | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const playbackRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    let cancelled = false;
    if (clip.videoPath) {
      supabase.storage.from("videos").createSignedUrl(clip.videoPath, 60 * 60).then(({ data }) => {
        if (!cancelled && data?.signedUrl) setVideoUrl(data.signedUrl);
      });
    }
    return () => { cancelled = true; };
  }, [clip.videoPath]);

  function speedAt(t: number) {
    if (!clip.readings.length) return null;
    const window = clip.readings.filter((r) => r.time >= t && r.time <= t + 1.0);
    if (window.length) {
      return window.reduce((best, r) => (r.speed > best.speed ? r : best), window[0]);
    }
    let best = clip.readings[0];
    let bestDiff = Math.abs(best.time - t);
    for (const r of clip.readings) {
      const d = Math.abs(r.time - t);
      if (d < bestDiff) { best = r; bestDiff = d; }
    }
    return best;
  }
  function startTag(a: BenchActionType) {
    const t = playbackRef.current?.currentTime ?? currentTime;
    setPendingTag({ action: a, time: t });
  }
  function confirmTag(success: boolean) {
    if (!pendingTag) return;
    const next = [...tags, { id: benchUid(), time: pendingTag.time, action: pendingTag.action, success }].sort((a, b) => a.time - b.time);
    setTags(next);
    setPendingTag(null);
    onTagsChanged(next);
  }
  function removeTag(id: string) {
    const next = tags.filter((t) => t.id !== id);
    setTags(next);
    onTagsChanged(next);
  }

  const profileData = binByTime(clip.readings);
  const yMax = Math.max(clip.peakSpeed, 1) * 1.1;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-black"
              style={{ background: CLIP_ACTION_COLORS[clip.action] }}
            >
              {clip.action}
            </span>
            <span className="text-sm">
              Peak {clip.peakSpeed.toFixed(2)} m/s · Avg {clip.avgSpeed.toFixed(2)} m/s
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {videoUrl ? (
            <video
              ref={playbackRef}
              src={videoUrl}
              controls
              playsInline
              onTimeUpdate={(e) => setCurrentTime((e.target as HTMLVideoElement).currentTime)}
              onSeeked={(e) => setCurrentTime((e.target as HTMLVideoElement).currentTime)}
              className="w-full rounded-md bg-black"
              style={{ maxHeight: 400 }}
            />
          ) : clip.videoPath ? (
            <div className="grid h-32 place-items-center rounded-md bg-[var(--bg-elevated)] text-xs text-[var(--text-secondary)]">Loading video…</div>
          ) : null}

          {profileData.length > 0 && (
            <SpeedProfileChart title="Speed profile" data={profileData} color={BENCHMARK_COLOR} yMax={yMax} />
          )}

          <div className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3">
            <div className="metric-label mb-2">Tag action at {currentTime.toFixed(2)}s</div>
            <div className="flex flex-wrap gap-2">
              {BENCH_ACTION_TYPES.map((a) => (
                <button
                  key={a}
                  onClick={() => startTag(a)}
                  disabled={!!pendingTag}
                  className="rounded-md px-3 py-1.5 text-xs font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-40"
                  style={{ background: BENCH_ACTION_COLORS[a] }}
                >
                  {a}
                </button>
              ))}
            </div>
            {pendingTag && (
              <div className="mt-3 flex flex-wrap items-center gap-3 rounded-md border border-[var(--border-default)] bg-[var(--bg-default)] px-3 py-2">
                <span className="text-xs text-[var(--text-secondary)]">
                  <span
                    className="mr-2 rounded-full px-2 py-0.5 text-[10px] font-semibold text-black"
                    style={{ background: BENCH_ACTION_COLORS[pendingTag.action] }}
                  >
                    {pendingTag.action}
                  </span>
                  at {pendingTag.time.toFixed(2)}s — Successful?
                </span>
                <div className="ml-auto flex items-center gap-2">
                  <button onClick={() => confirmTag(true)} className="rounded-md bg-[var(--data-positive)] px-3 py-1 text-xs font-semibold text-black hover:opacity-90">Yes</button>
                  <button onClick={() => confirmTag(false)} className="rounded-md bg-[var(--data-negative)] px-3 py-1 text-xs font-semibold text-black hover:opacity-90">No</button>
                  <button onClick={() => setPendingTag(null)} className="rounded-md border border-[var(--border-default)] px-3 py-1 text-xs hover:bg-[var(--bg-elevated)]">Cancel</button>
                </div>
              </div>
            )}
          </div>

          {tags.length > 0 && (
            <div className="max-h-56 overflow-auto rounded-md border border-[var(--border-subtle)]">
              <table className="w-full text-sm">
                <thead className="bg-[var(--bg-elevated)] text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">
                  <tr>
                    <th className="px-3 py-2 text-left">Time</th>
                    <th className="px-3 py-2 text-left">Action</th>
                    <th className="px-3 py-2 text-left">Result</th>
                    <th className="px-3 py-2 text-left">Peak speed (1s window)</th>
                    <th className="px-3 py-2 w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {tags.map((tg) => {
                    const r = speedAt(tg.time);
                    return (
                      <tr key={tg.id}>
                        <td className="px-3 py-1.5 tabular-nums">
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
                        <td className="px-3 py-1.5">
                          <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-black" style={{ background: BENCH_ACTION_COLORS[tg.action] }}>
                            {tg.action}
                          </span>
                        </td>
                        <td className="px-3 py-1.5">
                          <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-black" style={{ background: tg.success ? "var(--data-positive)" : "var(--data-negative)" }}>
                            {tg.success ? "Success" : "Fail"}
                          </span>
                        </td>
                        <td className="px-3 py-1.5 tabular-nums">{r ? r.speed.toFixed(2) : "—"}</td>
                        <td className="px-3 py-1.5 text-right">
                          <button onClick={() => removeTag(tg.id)} className="inline-flex items-center justify-center rounded-md p-1 text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--data-negative)]" aria-label="Delete tag">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ComparisonSection({
  athleteName,
  athleteStats,
  fencer,
}: {
  athleteName: string;
  athleteStats: { peakSpeed: number; avgSpeed: number; peakAdvance: number; peakRetreat: number; readings: BenchReading[]; actionAvgSpeeds: Record<string, number> };
  fencer: BenchFencer;
}) {
  const allReadings = allReadingsFromClips(fencer.clips);
  if (!allReadings.length) return null;
  const benchStats = statsFromReadings(allReadings);
  const metrics: { key: keyof typeof benchStats; label: string }[] = [
    { key: "peakSpeed", label: "Peak Speed" },
    { key: "avgSpeed", label: "Avg Speed" },
    { key: "peakAdvance", label: "Peak Advance" },
    { key: "peakRetreat", label: "Peak Retreat" },
  ];
  const benchmarkActionAvgs = actionAvgFromClips(fencer.clips);
  const yMax = Math.max(benchStats.peakSpeed, athleteStats.peakSpeed) * 1.1;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Comparison</h3>
        <p className="mt-1 text-xs text-[var(--text-secondary)]">
          {athleteName || "Athlete"}'s average across all sessions vs. {fencer.name} (across {fencer.clips.length} clip{fencer.clips.length === 1 ? "" : "s"}).
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        {metrics.map((m) => (
          <ComparisonCard
            key={m.key}
            label={m.label}
            athleteValue={athleteStats[m.key] as number}
            benchmarkValue={benchStats[m.key]}
          />
        ))}
      </div>

      <ActionComparisonTable
        athleteName={athleteName}
        benchmarkName={fencer.name}
        athleteActions={athleteStats.actionAvgSpeeds}
        benchmarkActions={benchmarkActionAvgs}
      />

      <SpeedProfileChart
        title={`${fencer.name} — Speed Profile`}
        data={binByTime(allReadings)}
        color={BENCHMARK_COLOR}
        yMax={yMax}
      />
      <SpeedProfileChart
        title={`${athleteName || "Athlete"} — Average Speed Profile`}
        data={binByTime(athleteStats.readings)}
        color="var(--accent)"
        yMax={yMax}
      />
    </div>
  );
}

function SpeedProfileChart({
  title,
  data,
  color,
  yMax,
}: {
  title: string;
  data: { t: number; speed: number }[];
  color: string;
  yMax: number;
}) {
  const gradId = `grad-${title.replace(/[^a-z0-9]/gi, "")}`;
  return (
    <div className="surface p-5">
      <div className="metric-label mb-3">{title}</div>
      <div className="h-56">
        <ClientOnly fallback={<div className="h-full w-full animate-pulse rounded bg-[var(--bg-elevated)]" />}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, bottom: 5, left: -10 }}>
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.55} />
                  <stop offset="100%" stopColor={color} stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--border-subtle)" vertical={false} />
              <XAxis
                dataKey="t"
                tick={{ fill: "var(--text-secondary)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                label={{ value: "Time (s)", position: "insideBottom", offset: -2, fill: "var(--text-secondary)", fontSize: 11 }}
              />
              <YAxis
                domain={[0, yMax || "auto"]}
                tick={{ fill: "var(--text-secondary)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                label={{ value: "Speed (m/s)", angle: -90, position: "insideLeft", fill: "var(--text-secondary)", fontSize: 11 }}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border-default)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(v: any) => (typeof v === "number" ? `${v.toFixed(2)} m/s` : v)}
                labelFormatter={(v: any) => `t = ${v}s`}
              />
              <Area
                type="monotone"
                dataKey="speed"
                stroke={color}
                strokeWidth={2}
                fill={`url(#${gradId})`}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ClientOnly>
      </div>
    </div>
  );
}


function ComparisonCard({
  label,
  athleteValue,
  benchmarkValue,
}: {
  label: string;
  athleteValue: number;
  benchmarkValue: number;
}) {
  const gap = athleteValue - benchmarkValue;
  const pctGap = benchmarkValue > 0 ? (gap / benchmarkValue) * 100 : 0;
  // pctGap negative => below benchmark
  let color = "var(--data-positive, #10b981)";
  let tone = "bg-emerald-500/10 text-emerald-400";
  if (pctGap < -30) {
    color = "var(--data-negative)";
    tone = "bg-rose-500/10 text-rose-400";
  } else if (pctGap < -10) {
    color = "#f59e0b";
    tone = "bg-amber-500/10 text-amber-400";
  }
  return (
    <div className="surface p-4">
      <div className="metric-label">{label}</div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Athlete</div>
          <div className="text-lg font-bold tabular-nums">{athleteValue.toFixed(2)}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Benchmark</div>
          <div className="text-lg font-bold tabular-nums" style={{ color: BENCHMARK_COLOR }}>{benchmarkValue.toFixed(2)}</div>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between text-xs">
        <span className="text-[var(--text-secondary)]">Gap</span>
        <span className={`rounded-full px-2 py-0.5 font-semibold tabular-nums ${tone}`}>
          {gap >= 0 ? "+" : ""}{gap.toFixed(2)} m/s ({pctGap >= 0 ? "+" : ""}{pctGap.toFixed(0)}%)
        </span>
      </div>
    </div>
  );
}

function ActionComparisonTable({
  athleteName,
  benchmarkName,
  athleteActions,
  benchmarkActions,
}: {
  athleteName: string;
  benchmarkName: string;
  athleteActions: Record<string, number>;
  benchmarkActions: Record<string, number>;
}) {
  const shared = BENCH_ACTION_TYPES.filter(
    (a) => athleteActions[a] != null && benchmarkActions[a] != null,
  );

  if (shared.length === 0) {
    return (
      <div className="surface p-5">
        <div className="metric-label mb-2">Action Comparison</div>
        <p className="text-xs text-[var(--text-secondary)]">
          Tag actions in both {athleteName || "the athlete"}'s session videos and the benchmark video to see a side-by-side action comparison here.
        </p>
      </div>
    );
  }

  return (
    <div className="surface overflow-hidden">
      <div className="border-b border-[var(--border-subtle)] px-5 py-3">
        <div className="metric-label">Action Comparison</div>
        <p className="mt-1 text-xs text-[var(--text-secondary)]">
          Peak speed (1s window) averaged across tagged actions. Green = within 10%, amber = 10–30% gap, red = more than 30% below.
        </p>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-[var(--bg-elevated)] text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">
          <tr>
            <th className="px-5 py-2 text-left">Action</th>
            <th className="px-5 py-2 text-right">{athleteName || "Athlete"}</th>
            <th className="px-5 py-2 text-right">{benchmarkName}</th>
            <th className="px-5 py-2 text-right">Gap</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border-subtle)]">
          {shared.map((a) => {
            const ath = athleteActions[a];
            const bm = benchmarkActions[a];
            const gap = ath - bm;
            const pct = bm > 0 ? (gap / bm) * 100 : 0;
            let tone = "bg-emerald-500/10 text-emerald-400";
            if (pct < -30) tone = "bg-rose-500/10 text-rose-400";
            else if (pct < -10) tone = "bg-amber-500/10 text-amber-400";
            return (
              <tr key={a} className="row-hover">
                <td className="px-5 py-2.5">
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-black"
                    style={{ background: BENCH_ACTION_COLORS[a] }}
                  >
                    {a}
                  </span>
                </td>
                <td className="px-5 py-2.5 text-right tabular-nums">{ath.toFixed(2)} m/s</td>
                <td className="px-5 py-2.5 text-right tabular-nums" style={{ color: BENCHMARK_COLOR }}>
                  {bm.toFixed(2)} m/s
                </td>
                <td className="px-5 py-2.5 text-right">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${tone}`}>
                    {gap >= 0 ? "+" : ""}{gap.toFixed(2)} m/s ({pct >= 0 ? "+" : ""}{pct.toFixed(0)}%)
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
