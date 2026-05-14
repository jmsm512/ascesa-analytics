import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell } from "@/components/AppShell";
import { SportIcon } from "@/components/SportIcon";
import { listAthletes, listRecentSessions, getBenchmarks } from "@/lib/data";
import { ArrowRight, Plus } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/")({
  component: DashboardRoute,
  head: () => ({ meta: [{ title: "Dashboard — Ascesa Analytics" }] }),
});

function DashboardRoute() {
  return (
    <RequireAuth>
      <AppShell>
        <Dashboard />
      </AppShell>
    </RequireAuth>
  );
}

function Dashboard() {
  const navigate = useNavigate();
  const athletes = useQuery({ queryKey: ["athletes"], queryFn: listAthletes });
  const recent = useQuery({ queryKey: ["recent"], queryFn: () => listRecentSessions(5) });

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between">
        <div>
          <div className="metric-label mb-2">Overview</div>
          <h1 className="text-3xl font-bold tracking-tight">Athletes</h1>
        </div>
        <button
          onClick={() => navigate({ to: "/sessions/new" })}
          className="inline-flex items-center gap-2 rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[#001813] hover:bg-[var(--accent-dim)]"
        >
          <Plus className="h-4 w-4" /> New Session
        </button>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {athletes.data?.map((a) => (
          <AthleteCard key={a.id} athlete={a} />
        ))}
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recent activity</h2>
          <span className="text-xs text-[var(--text-secondary)]">Last 5 sessions</span>
        </div>
        <div className="surface divide-y divide-[var(--border-subtle)] overflow-hidden">
          {recent.data?.length === 0 && (
            <div className="px-5 py-8 text-center text-sm text-[var(--text-secondary)]">No sessions yet.</div>
          )}
          {recent.data?.map((s: any) => (
            <Link
              key={s.id}
              to={s.sport === "hockey" ? "/sessions/hockey/$id" : "/sessions/fencing/$id"}
              params={{ id: s.id }}
              className="row-hover flex items-center gap-4 px-5 py-4"
            >
              <div
                className="grid h-9 w-9 place-items-center rounded-lg"
                style={{ background: s.sport === "hockey" ? "rgba(59,158,255,0.12)" : "rgba(167,139,250,0.12)" }}
              >
                <SportIcon
                  sport={s.sport}
                  className="h-4 w-4"
                />
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium">{s.athletes?.name} — {s.session_type}</div>
                <div className="text-xs text-[var(--text-secondary)]">
                  {formatDistanceToNow(new Date(s.session_date), { addSuffix: true })}
                  {s.location ? ` · ${s.location}` : ""}
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-[var(--text-muted)]" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function AthleteCard({ athlete }: { athlete: any }) {
  const benchmarks = useQuery({
    queryKey: ["benchmarks", athlete.id],
    queryFn: () => getBenchmarks(athlete.id),
  });

  const accent = athlete.sport === "hockey" ? "var(--hockey)" : "var(--fencing)";
  const headline = benchmarks.data?.[0];

  return (
    <div
      className="surface relative overflow-hidden p-6"
      style={{ borderLeft: `4px solid ${accent}` }}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="metric-label mb-2 flex items-center gap-2">
            <SportIcon sport={athlete.sport} className="h-3.5 w-3.5" />
            {athlete.sport}
          </div>
          <h3 className="text-2xl font-bold tracking-tight">{athlete.name}</h3>
          <div className="mt-1 text-xs text-[var(--text-secondary)]">
            {athlete.sport === "hockey"
              ? `${athlete.position ?? ""} · ${athlete.team ?? ""}`
              : `${athlete.weapon ?? ""} · ${athlete.club ?? ""}`}
          </div>
        </div>
        <Link
          to="/athletes/$id"
          params={{ id: athlete.id }}
          className="rounded-md border border-[var(--border-default)] px-3 py-1.5 text-xs hover:bg-[var(--bg-hover)]"
        >
          Profile
        </Link>
      </div>

      <div className="mt-6 flex items-end justify-between">
        <div>
          <div className="metric-label mb-1">{headline?.metric_name?.replaceAll("_", " ") ?? "—"}</div>
          <div className="metric-num-md">
            {headline ? `${headline.value}` : "—"}
            <span className="ml-1 text-base font-medium text-[var(--text-secondary)]">{headline?.unit ?? ""}</span>
          </div>
        </div>
        <Link
          to="/sessions/new"
          className="inline-flex items-center gap-1.5 rounded-md bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-[#001813] hover:bg-[var(--accent-dim)]"
        >
          <Plus className="h-3.5 w-3.5" /> New Session
        </Link>
      </div>
    </div>
  );
}
