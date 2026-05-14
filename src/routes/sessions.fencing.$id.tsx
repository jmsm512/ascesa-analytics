import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell } from "@/components/AppShell";
import { getFencingSession } from "@/lib/data";
import { format } from "date-fns";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { ArrowLeft, Check, X } from "lucide-react";

export const Route = createFileRoute("/sessions/fencing/$id")({
  component: FencingSession,
});

const TABS = ["Overview", "Actions", "Video"] as const;

function FencingSession() {
  const { id } = Route.useParams();
  const [tab, setTab] = useState<(typeof TABS)[number]>("Overview");
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
                <SensorChart title="Attack speed (m/s)" data={sensors} dataKey="attack_speed_ms" />
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
          <div className="surface mt-6 grid place-items-center p-16 text-center text-sm text-[var(--text-secondary)]">
            No video attached to this bout.
          </div>
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
