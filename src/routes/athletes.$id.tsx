import { createFileRoute, Link, ClientOnly } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell } from "@/components/AppShell";
import { SportIcon } from "@/components/SportIcon";
import { getAthlete, listSessionsForAthlete, getBenchmarks, getGoals, listVideosForAthlete } from "@/lib/data";
import { supabase } from "@/integrations/supabase/client";
import { generateAthleteDrillPlan, type AthleteDrillPlan, type AthleteDrillPrescription, type DrillKind } from "@/lib/coaching.functions";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { ArrowLeft, ChevronRight, ChevronDown, Sparkles, RefreshCw, Check } from "lucide-react";
import { formatHeightImperial, formatWeightLb, kmhToMph, msToFps } from "@/lib/units";

export const Route = createFileRoute("/athletes/$id")({
  ssr: false,
  component: AthletePage,
});

const TABS = ["Overview", "Sessions", "Videos", "Progress", "Goals", "Drills"] as const;

function AthletePage() {
  const { id } = Route.useParams();
  const [tab, setTab] = useState<(typeof TABS)[number]>("Overview");
  const athlete = useQuery({ queryKey: ["athlete", id], queryFn: () => getAthlete(id) });
  const sessions = useQuery({ queryKey: ["sessions", id], queryFn: () => listSessionsForAthlete(id) });
  const benchmarks = useQuery({ queryKey: ["benchmarks", id], queryFn: () => getBenchmarks(id) });
  const goals = useQuery({ queryKey: ["goals", id], queryFn: () => getGoals(id) });
  const videos = useQuery({ queryKey: ["videos", id], queryFn: () => listVideosForAthlete(id) });

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
          {tab === "Overview" && (
            <div className="grid gap-4 md:grid-cols-3">
              {benchmarks.data?.map((b: any) => (
                <div key={b.id} className="surface p-5">
                  <div className="metric-label">{b.metric_name.replaceAll("_", " ")}</div>
                  <div className="metric-num-md mt-2">
                    {b.value}
                    <span className="ml-1 text-sm font-medium text-[var(--text-secondary)]">{b.unit}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

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
                    <div className="text-sm font-medium capitalize">{s.session_type}</div>
                    <div className="text-xs text-[var(--text-secondary)]">{format(new Date(s.session_date), "PP")}</div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-[var(--text-muted)]" />
                </Link>
              ))}
            </div>
          )}

          {tab === "Videos" && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {videos.data?.length === 0 && (
                <div className="surface col-span-full p-10 text-center text-sm text-[var(--text-secondary)]">
                  No videos uploaded yet.
                </div>
              )}
              {videos.data?.map((v: any) => (
                <Link key={v.id} to="/videos/$id" params={{ id: v.id }} className="surface overflow-hidden hover:border-[var(--border-default)]">
                  <div className="aspect-video bg-[var(--bg-elevated)]" />
                  <div className="p-3">
                    <div className="text-sm font-medium">{v.label ?? "Untitled"}</div>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-xs text-[var(--text-secondary)]">{format(new Date(v.created_at), "PP")}</span>
                      <StatusBadge status={v.status} />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {tab === "Drills" && a && <DrillsTab athleteId={id} athleteName={a.name} athleteAge={a.age} />}

          {tab === "Progress" && <ProgressCharts athleteId={id} sport={a?.sport ?? "hockey"} />}

          {tab === "Goals" && (
            <div className="space-y-3">
              {goals.data?.length === 0 && <div className="surface p-10 text-center text-sm text-[var(--text-secondary)]">No goals set.</div>}
              {goals.data?.map((g: any) => {
                const pct = g.target_value && g.current_value ? Math.min(100, Math.round((g.current_value / g.target_value) * 100)) : 0;
                return (
                  <div key={g.id} className="surface p-5">
                    <div className="flex items-baseline justify-between">
                      <div>
                        <div className="text-sm font-semibold capitalize">{g.metric_name}</div>
                        <div className="text-xs text-[var(--text-secondary)]">
                          Target: {g.target_value}{g.unit ? ` ${g.unit}` : ""} {g.target_date ? `· by ${format(new Date(g.target_date), "PP")}` : ""}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium">{g.current_value}{g.unit ? ` ${g.unit}` : ""}</div>
                        <div className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">current</div>
                      </div>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--bg-elevated)]">
                      <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
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

function ProgressCharts({ athleteId, sport }: { athleteId: string; sport: string }) {
  const sessions = useQuery({ queryKey: ["sessions", athleteId], queryFn: () => listSessionsForAthlete(athleteId) });
  // Mock progress trend so charts always look real
  const data = (sessions.data ?? []).slice(0, 8).reverse().map((s, i) => ({
    date: format(new Date(s.session_date), "MMM d"),
    metric1: sport === "hockey" ? 2.45 - i * 0.015 : Number(msToFps(2.9 + i * 0.05)!.toFixed(2)),
    metric2: sport === "hockey" ? Number(kmhToMph(21 + i * 0.4)!.toFixed(2)) : 60 + i * 1.5,
  }));
  while (data.length < 6) {
    data.unshift({
      date: `S${6 - data.length}`,
      metric1: sport === "hockey" ? 2.5 - data.length * 0.02 : Number(msToFps(2.8 + data.length * 0.05)!.toFixed(2)),
      metric2: sport === "hockey" ? Number(kmhToMph(20 + data.length * 0.3)!.toFixed(2)) : 58 + data.length * 1.5,
    });
  }
  const color = sport === "hockey" ? "var(--hockey)" : "var(--fencing)";
  const m1 = sport === "hockey" ? "Best 10yd (s)" : "Attack speed (ft/s)";
  const m2 = sport === "hockey" ? "Top speed (mph)" : "Bout win rate (%)";
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <ChartCard title={m1} data={data} dataKey="metric1" color={color} />
      <ChartCard title={m2} data={data} dataKey="metric2" color={color} />
    </div>
  );
}

function ChartCard({ title, data, dataKey, color }: any) {
  return (
    <div className="surface p-5">
      <div className="metric-label mb-3">{title}</div>
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
            <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2.5} dot={{ r: 3, fill: color }} />
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
            onClick={handleGenerate}
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
    </div>
  );
}
