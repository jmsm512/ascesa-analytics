import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell } from "@/components/AppShell";
import { getHockeySession } from "@/lib/data";
import { format } from "date-fns";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, Legend,
} from "recharts";
import { ArrowLeft, TrendingUp } from "lucide-react";
import { kmhToMph } from "@/lib/units";
import { SessionEditDelete } from "@/components/SessionEditDelete";

export const Route = createFileRoute("/sessions/hockey/$id")({
  component: HockeySession,
});

const PHASES = [
  { key: "baseline", label: "Baseline" },
  { key: "resisted", label: "Resisted" },
  { key: "closing", label: "Closing" },
  { key: "flying", label: "Flying Sprint" },
] as const;

function HockeySession() {
  const { id } = Route.useParams();
  const [phase, setPhase] = useState<string>("baseline");
  const q = useQuery({ queryKey: ["hockey-session", id], queryFn: () => getHockeySession(id) });

  const reps = (q.data?.reps ?? []).filter((r) => r.phase === phase);
  const allPhaseReps = q.data?.reps ?? [];
  const session = q.data?.session;

  const best10m = reps.length ? Math.min(...reps.map((r) => Number(r.time_10m) || Infinity).filter(isFinite)) : null;
  const topSpeed = reps.length ? kmhToMph(Math.max(...reps.map((r) => Number(r.peak_kmh) || 0))) : null;

  return (
    <RequireAuth>
      <AppShell>
        <Link to="/" className="inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </Link>

        {session && (
          <div className="surface mt-4 p-6" style={{ borderLeft: "4px solid var(--hockey)" }}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="metric-label mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span>Hockey Sprint Session</span>
                  <span className="text-[var(--text-secondary)] normal-case tracking-normal">
                    {format(new Date(session.session_date), "EEEE, MMM d")}
                  </span>
                </div>
                <h1 className="text-2xl font-bold tracking-tight">
                  {(session as any).name?.trim() || format(new Date(session.session_date), "EEEE, MMM d")}
                </h1>
                <div className="mt-2 text-sm text-[var(--text-secondary)]">
                  {session.location && <>{session.location} · </>}
                  {session.notes}
                </div>
              </div>
              <SessionEditDelete session={session as any} onSaved={() => q.refetch()} />
            </div>
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-2">
          {PHASES.map((p) => (
            <button
              key={p.key}
              onClick={() => setPhase(p.key)}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
                phase === p.key
                  ? "bg-[var(--accent-glow)] text-[var(--accent)] ring-1 ring-[var(--accent)]/40"
                  : "bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {phase === "resisted" && (
          <div className="mt-4 inline-flex items-center gap-2 rounded-md bg-[var(--accent-glow)] px-3 py-2 text-xs text-[var(--accent)]">
            <TrendingUp className="h-3.5 w-3.5" /> Performance improves as load decreases ✓
          </div>
        )}

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <StatCard label="Best 10m" value={best10m ? `${best10m.toFixed(2)}` : "—"} unit="s" highlight />
          <StatCard label="Top Speed" value={topSpeed ? `${topSpeed.toFixed(1)}` : "—"} unit="mph" />
          <StatCard label="Total Reps" value={String(reps.length)} unit="reps" />
        </div>

        {reps.length > 0 && (
          <>
            <div className="mt-8 surface overflow-hidden">
              <div className="border-b border-[var(--border-subtle)] px-5 py-3">
                <div className="metric-label">Rep-by-rep</div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[var(--text-secondary)]">
                      <Th>Rep</Th><Th>Time</Th><Th>Peak mph</Th><Th>10M (s)</Th><Th>5M split</Th><Th>7.5M split</Th><Th>% of Max</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {reps.map((r, i) => (
                      <tr key={r.id} className="row-hover border-t border-[var(--border-subtle)]">
                        <Td>{r.rep_number}</Td>
                        <Td>{format(new Date(r.created_at), "HH:mm")}</Td>
                        <Td>{kmhToMph(Number(r.peak_kmh))!.toFixed(1)}</Td>
                        <Td className={r.is_pb ? "font-bold text-[var(--accent)]" : ""}>
                          {Number(r.time_10m).toFixed(2)}
                          {r.is_pb && <span className="ml-2 rounded-full bg-[var(--accent-glow)] px-1.5 py-0.5 text-[9px] font-semibold uppercase text-[var(--accent)]">PB</span>}
                        </Td>
                        <Td>{Number(r.split_5m).toFixed(2)}</Td>
                        <Td>{Number(r.split_7_5m).toFixed(2)}</Td>
                        <Td>{Number(r.pct_of_max).toFixed(0)}%</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-6 surface p-5">
              <div className="metric-label mb-3">Top speed per rep</div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={reps.map((r) => ({ rep: `R${r.rep_number}`, peak: Number(kmhToMph(Number(r.peak_kmh))!.toFixed(2)) }))}>
                    <CartesianGrid stroke="var(--border-subtle)" vertical={false} />
                    <XAxis dataKey="rep" tick={{ fill: "var(--text-secondary)", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "var(--text-secondary)", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Line type="monotone" dataKey="peak" stroke="var(--hockey)" strokeWidth={2.5} dot={{ r: 4, fill: "var(--hockey)" }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {phase === "resisted" && <LoadBreakdown reps={allPhaseReps.filter((r) => r.phase === "resisted")} />}
          </>
        )}

        {reps.length === 0 && (
          <div className="surface mt-6 p-10 text-center text-sm text-[var(--text-secondary)]">No reps recorded for this phase.</div>
        )}
      </AppShell>
    </RequireAuth>
  );
}

function StatCard({ label, value, unit, highlight }: { label: string; value: string; unit: string; highlight?: boolean }) {
  return (
    <div className={`surface p-5 ${highlight ? "border-t-2 !border-t-[var(--accent)]" : ""}`}>
      <div className="metric-label">{label}</div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="metric-num-md">{value}</span>
        <span className="text-sm text-[var(--text-secondary)]">{unit}</span>
      </div>
    </div>
  );
}

function LoadBreakdown({ reps }: { reps: any[] }) {
  const groups = ["10", "7", "5", "3"].map((lp) => {
    const sub = reps.filter((r) => String(Number(r.load_pct)) === lp);
    if (!sub.length) return null;
    const best = Math.min(...sub.map((r) => Number(r.time_10m)));
    const avg = sub.reduce((s, r) => s + Number(r.time_10m), 0) / sub.length;
    const top = kmhToMph(Math.max(...sub.map((r) => Number(r.peak_kmh))))!;
    return { load: `${lp}% BW`, best: +best.toFixed(2), avg: +avg.toFixed(2), top: +top.toFixed(1) };
  }).filter(Boolean) as any[];

  return (
    <div className="mt-6 surface p-5">
      <div className="metric-label mb-3">Load breakdown</div>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={groups} barCategoryGap={20}>
            <CartesianGrid stroke="var(--border-subtle)" vertical={false} />
            <XAxis dataKey="load" tick={{ fill: "var(--text-secondary)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "var(--text-secondary)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 11, color: "var(--text-secondary)" }} />
            <Bar dataKey="best" name="Best 10m (s)" fill="var(--accent)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="avg" name="Avg 10m (s)" fill="var(--data-neutral)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="top" name="Top speed (mph)" fill="var(--hockey)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

const tooltipStyle = {
  background: "var(--bg-elevated)",
  border: "1px solid var(--border-default)",
  borderRadius: 8,
  fontSize: 12,
};

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider">{children}</th>;
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 ${className}`}>{children}</td>;
}
