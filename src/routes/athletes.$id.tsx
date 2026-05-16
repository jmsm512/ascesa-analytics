import { createFileRoute, Link, ClientOnly } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell } from "@/components/AppShell";
import { SportIcon } from "@/components/SportIcon";
import { getAthlete, listSessionsForAthlete, getBenchmarks, getGoals } from "@/lib/data";
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
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Legend, ReferenceLine } from "recharts";
import { ArrowLeft, ArrowUpDown, ChevronRight, ChevronDown, Sparkles, RefreshCw, Check, Plus, Pencil, Trash2, Upload, RotateCcw, X } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";
import { formatHeightImperial, formatWeightLb, kmhToMph, msToFps } from "@/lib/units";

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
          {tab === "Overview" && a && <OverviewTab athleteId={id} athleteName={a.name} />}

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
    const readings = fs?.speed_analysis?.readings as Array<{ speed: number; direction: string }> | undefined;
    if (!readings?.length) continue;
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

  const recent = sessions.slice(0, 3).map((s) => {
    const fs = fsBySession.get(s.id);
    const readings = fs?.speed_analysis?.readings as Array<{ speed: number }> | undefined;
    const peak = readings?.length ? Math.max(...readings.map((r) => r.speed)) : null;
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
  };
}

function OverviewTab({ athleteId, athleteName: _athleteName }: { athleteId: string; athleteName: string }) {
  const q = useQuery({ queryKey: ["overview", athleteId], queryFn: () => loadOverviewData(athleteId) });
  const d = q.data;

  if (q.isLoading || !d) {
    return <div className="surface p-6 text-sm text-[var(--text-secondary)]">Loading overview…</div>;
  }

  if (d.totalSessions === 0) {
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
  const rows: ProgressRow[] = [];
  for (const fs of fsRows ?? []) {
    const readings = (fs as any)?.speed_analysis?.readings as Array<{ speed: number; direction: string }> | undefined;
    if (!readings?.length) continue;
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

  let analyses: Array<{ readings: Array<{ speed: number; direction: string }>; tags?: Array<{ action: string; success: boolean }> }> = [];
  if (sessionIds.length) {
    const { data: fsRows } = await supabase
      .from("fencing_sessions")
      .select("speed_analysis")
      .in("session_id", sessionIds);
    analyses = (fsRows ?? [])
      .map((r: any) => r.speed_analysis)
      .filter((a: any) => a && Array.isArray(a.readings) && a.readings.length);
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
    const readings = (r as any)?.speed_analysis?.readings as Array<{ speed: number; direction: string }> | undefined;
    if (!readings?.length) continue;
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
  for (const r of (fsRows ?? []) as any[]) {
    const readings = r?.speed_analysis?.readings as BenchReading[] | undefined;
    if (!readings?.length) continue;
    const speeds = readings.map((x) => x.speed);
    peaks.push(Math.max(...speeds));
    all.push(...speeds);
    const adv = readings.filter((x) => x.direction === "advance").map((x) => x.speed);
    if (adv.length) advPeaks.push(Math.max(...adv));
    const ret = readings.filter((x) => x.direction === "retreat").map((x) => x.speed);
    if (ret.length) retPeaks.push(Math.max(...ret));
    allReadings.push(...readings);
  }
  const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);
  result.peakSpeed = mean(peaks);
  result.avgSpeed = mean(all);
  result.peakAdvance = mean(advPeaks);
  result.peakRetreat = mean(retPeaks);
  result.readings = allReadings;
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

  const list = benchmarks.data ?? [];
  const primary = list[0];
  const additional = list.slice(1, 3);
  const canAddMore = list.length < 3;

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
    if (error) {
      alert(error.message);
      return;
    }
    await benchmarks.refetch();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Benchmarks</h2>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            Upload footage of elite fencers to compare against {athleteName || "this athlete"}'s data.
          </p>
        </div>
        {canAddMore && (
          <button
            onClick={addBenchmark}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-black hover:opacity-90"
          >
            <Plus className="h-3.5 w-3.5" /> Add Benchmark
          </button>
        )}
      </div>

      {list.length === 0 && (
        <div className="surface p-10 text-center">
          <div className="text-sm text-[var(--text-secondary)]">No benchmarks yet.</div>
          <button
            onClick={addBenchmark}
            className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-black hover:opacity-90"
          >
            <Plus className="h-3.5 w-3.5" /> Add Primary Benchmark
          </button>
        </div>
      )}

      {primary && (
        <BenchmarkCard
          benchmark={primary}
          isPrimary
          onUpdated={() => benchmarks.refetch()}
        />
      )}
      {additional.map((b) => (
        <BenchmarkCard key={b.id} benchmark={b} onUpdated={() => benchmarks.refetch()} />
      ))}

      {primary?.speed_analysis?.readings?.length > 0 && athleteStats.data && (
        <ComparisonSection
          athleteName={athleteName}
          athleteStats={athleteStats.data}
          benchmarks={list.filter((b: any) => b.speed_analysis?.readings?.length > 0)}
        />
      )}
    </div>
  );
}

function BenchmarkCard({
  benchmark,
  isPrimary,
  onUpdated,
}: {
  benchmark: any;
  isPrimary?: boolean;
  onUpdated: () => void;
}) {
  const analysis: BenchAnalysis | null = benchmark.speed_analysis ?? null;
  const hasResults = !!analysis?.readings?.length;

  type Stage = "upload" | "extracting" | "calibrate" | "analyzing" | "results";
  const [stage, setStage] = useState<Stage>(hasResults ? "results" : "upload");
  const [name, setName] = useState<string>(benchmark.name ?? "");
  const [notes, setNotes] = useState<string>(benchmark.notes ?? "");
  const [savingMeta, setSavingMeta] = useState(false);

  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [firstFrame, setFirstFrame] = useState<string | null>(null);
  const [duration, setDuration] = useState(analysis?.duration ?? 0);
  const [points, setPoints] = useState<BenchPt[]>(analysis?.points ?? []);
  const [progress, setProgress] = useState({ cur: 0, total: 0 });
  const [readings, setReadings] = useState<BenchReading[]>(analysis?.readings ?? []);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  async function saveMeta() {
    setSavingMeta(true);
    try {
      await supabase
        .from("benchmarks" as any)
        .update({ name: name.trim() || "Untitled Benchmark", notes: notes.trim() || null })
        .eq("id", benchmark.id);
      onUpdated();
    } finally {
      setSavingMeta(false);
    }
  }

  async function deleteBenchmark() {
    if (!confirm("Delete this benchmark and its analysis?")) return;
    await supabase.from("benchmarks" as any).delete().eq("id", benchmark.id);
    onUpdated();
  }

  async function persistVideo(file: File): Promise<string | null> {
    try {
      const { data: u } = await supabase.auth.getUser();
      const userId = u.user?.id;
      if (!userId) return null;
      const ext = (file.name.split(".").pop() || "mp4").toLowerCase();
      const path = `${userId}/benchmarks/${benchmark.id}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("videos")
        .upload(path, file, { contentType: file.type || "video/mp4", upsert: true });
      if (upErr) {
        console.error("benchmark video upload failed", upErr);
        return null;
      }
      return path;
    } catch (e) {
      console.error(e);
      return null;
    }
  }

  const MAX_VIDEO_MB = 150;

  function onFile(file: File) {
    const sizeMB = file.size / (1024 * 1024);
    if (sizeMB > MAX_VIDEO_MB) {
      setError(`File too large (${Math.round(sizeMB)} MB). Trim to under 2 minutes or compress: QuickTime → Export As → 1080p.`);
      setWarning(null);
      return;
    }
    setError(null);
    const isMov = /\.mov$/i.test(file.name) || file.type === "video/quicktime";
    setWarning(isMov ? "MOV files may not be supported. If upload fails, open in QuickTime → Export As → 1080p to convert to MP4." : null);
    setStage("extracting");
    setPendingFile(file);
    const reader = new FileReader();
    reader.onload = async () => {
      const url = reader.result as string;
      setDataUrl(url);
      try {
        const { frame, dur } = await extractBenchFirstFrame(url);
        setFirstFrame(frame);
        setDuration(dur);
        setPoints([]);
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
      await new Promise<void>((res, rej) => {
        v.addEventListener("loadeddata", () => res(), { once: true });
        v.addEventListener("error", () => rej(new Error(UNSUPPORTED_VIDEO_MESSAGE)), { once: true });
        attachVideoSources(v, dataUrl);
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

      const frames: BenchFrame[] = [];
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

      const W = v.videoWidth, H = v.videoHeight;
      const p0 = { x: points[0].x * W, y: points[0].y * H };
      const p1 = { x: points[1].x * W, y: points[1].y * H };
      const axis = { x: p1.x - p0.x, y: p1.y - p0.y };
      const axisLen = Math.hypot(axis.x, axis.y);
      const ux = axis.x / axisLen;
      const uy = axis.y / axisLen;
      const mPerPx = 14 / axisLen;

      const out: BenchReading[] = [];
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

      let videoPath: string | null = analysis?.videoPath ?? null;
      if (pendingFile) {
        const newPath = await persistVideo(pendingFile);
        if (newPath) videoPath = newPath;
      }
      const payload: BenchAnalysis = {
        readings: out,
        duration: v.duration,
        points,
        videoPath,
      };
      await supabase.from("benchmarks" as any).update({ speed_analysis: payload }).eq("id", benchmark.id);
      onUpdated();
    } catch (e: any) {
      setError(e?.message ?? "Analysis failed");
      setStage("calibrate");
    }
  }

  async function resetAnalysis() {
    if (!confirm("Reset this benchmark's video and analysis?")) return;
    setStage("upload");
    setDataUrl(null);
    setFirstFrame(null);
    setDuration(0);
    setPoints([]);
    setReadings([]);
    setProgress({ cur: 0, total: 0 });
    setError(null);
    await supabase.from("benchmarks" as any).update({ speed_analysis: null }).eq("id", benchmark.id);
    onUpdated();
  }

  const stats = statsFromReadings(readings);

  return (
    <div className="surface overflow-hidden" style={{ borderLeft: `4px solid ${BENCHMARK_COLOR}` }}>
      <div className="border-b border-[var(--border-subtle)] p-5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 space-y-2">
            <div className="metric-label">{isPrimary ? "Primary Benchmark" : "Additional Benchmark"}</div>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={saveMeta}
              placeholder='e.g. "Nathalie Moellhausen — Olympic Bronze"'
              className="font-semibold"
            />
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={saveMeta}
              placeholder="Notes (optional)"
            />
          </div>
          <button
            onClick={deleteBenchmark}
            title="Delete benchmark"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--data-negative)]"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
        {savingMeta && <div className="text-[10px] text-[var(--text-muted)]">Saving…</div>}
      </div>

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
            className="surface flex cursor-pointer flex-col items-center justify-center gap-3 p-10 text-center transition-colors hover:border-[var(--accent)]"
            style={{ borderWidth: 2, borderStyle: "dashed" }}
          >
            <Upload className="h-7 w-7 text-[var(--text-secondary)]" />
            <div className="text-sm font-medium">Upload benchmark video</div>
            <div className="text-xs text-[var(--text-secondary)]">MP4 recommended · MOV may need conversion</div>
            <input
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
            />
          </label>
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
          <div className="surface p-6 text-center text-sm text-[var(--text-secondary)]">
            Analyzing pose… {progress.cur}/{progress.total} frames
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--bg-elevated)]">
              <div
                className="h-full bg-[var(--accent)] transition-all"
                style={{ width: `${progress.total ? (progress.cur / progress.total) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}

        {stage === "results" && readings.length > 0 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <BenchStatBox label="Peak Speed" value={stats.peakSpeed} unit="m/s" />
              <BenchStatBox label="Avg Speed" value={stats.avgSpeed} unit="m/s" />
              <BenchStatBox label="Peak Advance" value={stats.peakAdvance} unit="m/s" />
              <BenchStatBox label="Peak Retreat" value={stats.peakRetreat} unit="m/s" />
            </div>
            <div className="flex justify-end">
              <button
                onClick={resetAnalysis}
                className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-default)] px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Re-upload
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function BenchStatBox({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div className="surface p-4">
      <div className="metric-label">{label}</div>
      <div className="mt-1 text-2xl font-bold tabular-nums">
        {value.toFixed(2)}
        <span className="ml-1 text-sm font-medium text-[var(--text-secondary)]">{unit}</span>
      </div>
    </div>
  );
}

function ComparisonSection({
  athleteName,
  athleteStats,
  benchmarks,
}: {
  athleteName: string;
  athleteStats: { peakSpeed: number; avgSpeed: number; peakAdvance: number; peakRetreat: number; readings: BenchReading[] };
  benchmarks: any[];
}) {
  const primary = benchmarks[0];
  if (!primary) return null;
  const primaryStats = statsFromReadings(primary.speed_analysis.readings as BenchReading[]);

  const metrics: { key: keyof typeof primaryStats; label: string }[] = [
    { key: "peakSpeed", label: "Peak Speed" },
    { key: "avgSpeed", label: "Avg Speed" },
    { key: "peakAdvance", label: "Peak Advance" },
    { key: "peakRetreat", label: "Peak Retreat" },
  ];

  const athleteBins = binReadings(athleteStats.readings);
  const benchBins = binReadings(primary.speed_analysis.readings as BenchReading[]);
  const merged: any[] = [];
  const len = Math.max(athleteBins.length, benchBins.length);
  for (let i = 0; i < len; i++) {
    merged.push({
      t: athleteBins[i]?.t ?? benchBins[i]?.t ?? Math.round((i / (len - 1)) * 100),
      athlete: athleteBins[i]?.speed ?? null,
      benchmark: benchBins[i]?.speed ?? null,
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Comparison</h3>
        <p className="mt-1 text-xs text-[var(--text-secondary)]">
          {athleteName || "Athlete"}'s average across all sessions vs. {primary.name}.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        {metrics.map((m) => (
          <ComparisonCard
            key={m.key}
            label={m.label}
            athleteValue={athleteStats[m.key] as number}
            benchmarkValue={primaryStats[m.key]}
          />
        ))}
      </div>

      <div className="surface p-5">
        <div className="metric-label mb-3">Speed Profile Overlay</div>
        <div className="h-72">
          <ClientOnly fallback={<div className="h-full w-full animate-pulse rounded bg-[var(--bg-elevated)]" />}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={merged} margin={{ top: 10, right: 10, bottom: 5, left: -10 }}>
                <CartesianGrid stroke="var(--border-subtle)" vertical={false} />
                <XAxis
                  dataKey="t"
                  tick={{ fill: "var(--text-secondary)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  label={{ value: "Bout progression (%)", position: "insideBottom", offset: -2, fill: "var(--text-secondary)", fontSize: 11 }}
                />
                <YAxis
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
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line
                  type="monotone"
                  dataKey="athlete"
                  name={athleteName || "Athlete"}
                  stroke={RIE_COLOR}
                  strokeWidth={2.5}
                  dot={false}
                  connectNulls
                />
                <Line
                  type="monotone"
                  dataKey="benchmark"
                  name={primary.name}
                  stroke={BENCHMARK_COLOR}
                  strokeWidth={2.5}
                  dot={false}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </ClientOnly>
        </div>
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
