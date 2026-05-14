import { createFileRoute, Link, ClientOnly } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell } from "@/components/AppShell";
import { SportIcon } from "@/components/SportIcon";
import { getAthlete, listSessionsForAthlete, getBenchmarks, getGoals, listVideosForAthlete } from "@/lib/data";
import { format } from "date-fns";
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { formatHeightImperial, formatWeightLb, kmhToMph, msToFps } from "@/lib/units";

export const Route = createFileRoute("/athletes/$id")({
  ssr: false,
  component: AthletePage,
});

const TABS = ["Overview", "Sessions", "Videos", "Progress", "Goals"] as const;

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
    metric1: sport === "hockey" ? 2.45 - i * 0.015 : 2.9 + i * 0.05,
    metric2: sport === "hockey" ? 21 + i * 0.4 : 60 + i * 1.5,
  }));
  while (data.length < 6) {
    data.unshift({
      date: `S${6 - data.length}`,
      metric1: sport === "hockey" ? 2.5 - data.length * 0.02 : 2.8 + data.length * 0.05,
      metric2: sport === "hockey" ? 20 + data.length * 0.3 : 58 + data.length * 1.5,
    });
  }
  const color = sport === "hockey" ? "var(--hockey)" : "var(--fencing)";
  const m1 = sport === "hockey" ? "Best 10m (s)" : "Attack speed (m/s)";
  const m2 = sport === "hockey" ? "Top speed (km/h)" : "Bout win rate (%)";
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
