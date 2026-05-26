import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { format } from "date-fns";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell } from "@/components/AppShell";
import { SportIcon } from "@/components/SportIcon";
import { listAthletes } from "@/lib/data";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Plus, Trash2, Check, CalendarIcon } from "lucide-react";
import { mphToKmh } from "@/lib/units";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/sessions/new")({
  component: NewSessionPage,
  validateSearch: (s: Record<string, unknown>) => ({
    athlete: typeof s.athlete === "string" ? s.athlete : undefined,
  }),
});

type HockeyRep = { rep_number: number; time_10m: string; peak_kmh: string };

function NewSessionPage() {
  const navigate = useNavigate();
  const { athlete: preselectedAthleteId } = Route.useSearch();
  const athletes = useQuery({ queryKey: ["athletes"], queryFn: listAthletes });
  const lockedAthlete = Boolean(preselectedAthleteId);
  const [step, setStep] = useState(1);
  const [athleteId, setAthleteId] = useState<string>(preselectedAthleteId ?? "");
  const [sessionType, setSessionType] = useState<string>("");
  const [sessionName, setSessionName] = useState<string>("");
  const [sessionDate, setSessionDate] = useState<Date>(new Date());
  const [hockeyReps, setHockeyReps] = useState<HockeyRep[]>([{ rep_number: 1, time_10m: "", peak_kmh: "" }]);
  const [fencingOpponent, setFencingOpponent] = useState("");
  const [fencingScore, setFencingScore] = useState({ scored: 0, received: 0 });
  const [fencingEventName, setFencingEventName] = useState("");
  const [fencingBoutType, setFencingBoutType] = useState<string>("");
  const [saving, setSaving] = useState(false);
  

  const athlete = athletes.data?.find((a) => a.id === athleteId);
  const isHockey = athlete?.sport === "hockey";

  const save = async () => {
    if (!athlete) return;
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const userId = u.user?.id;
    if (!userId) return;
    const { data: session, error } = await supabase
      .from("sessions")
      .insert({
        athlete_id: athlete.id,
        user_id: userId,
        sport: athlete.sport,
        session_type: sessionType,
        session_date: sessionDate.toISOString(),
        name: sessionName.trim() || null,
      })
      .select()
      .single();
    if (error || !session) {
      setSaving(false);
      return;
    }
    if (isHockey) {
      const { data: hss } = await supabase
        .from("hockey_sprint_sessions")
        .insert({ session_id: session.id, user_id: userId, body_weight_kg: athlete.weight_kg })
        .select()
        .single();
      if (hss) {
        const rows = hockeyReps
          .filter((r) => r.time_10m || r.peak_kmh)
          .map((r) => ({
            hockey_session_id: hss.id,
            user_id: userId,
            phase: "baseline",
            rep_number: r.rep_number,
            time_10m: r.time_10m ? Number(r.time_10m) : null,
            peak_kmh: r.peak_kmh ? mphToKmh(Number(r.peak_kmh)) : null,
          }));
        if (rows.length) await supabase.from("hockey_sprint_reps").insert(rows);
      }
      navigate({ to: "/sessions/hockey/$id", params: { id: session.id } });
    } else {
      await supabase
        .from("fencing_sessions")
        .insert({
          session_id: session.id,
          user_id: userId,
          weapon: athlete.weapon,
          opponent: fencingOpponent || "Sparring partner",
          touches_scored: fencingScore.scored,
          touches_received: fencingScore.received,
          event_name: fencingEventName.trim() || null,
          bout_type: fencingBoutType || null,
          result: fencingScore.scored > fencingScore.received ? "win" : fencingScore.scored < fencingScore.received ? "loss" : "draw",
        });
      navigate({ to: "/sessions/fencing/$id", params: { id: session.id }, search: { tab: "Video" } });
    }
  };

  return (
    <RequireAuth>
      <AppShell>
        <Link to="/" className="inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
          <ArrowLeft className="h-3.5 w-3.5" /> Cancel
        </Link>

        <div className="mt-4">
          <div className="metric-label mb-1">New Session</div>
          <h1 className="text-2xl font-bold tracking-tight">Step {step} of 3</h1>
        </div>

        <div className="mt-4 flex gap-1.5">
          {[1, 2, 3].map((s) => (
            <div key={s} className={`h-1 flex-1 rounded-full ${s <= step ? "bg-[var(--accent)]" : "bg-[var(--bg-elevated)]"}`} />
          ))}
        </div>

        <div className="mt-6">
          {step === 1 && (
            <div className="space-y-4">
              <div className="metric-label">Athlete</div>
              {lockedAthlete && athlete ? (
                <div
                  className="surface flex items-center gap-3 p-4"
                  style={{ borderLeft: `4px solid ${athlete.sport === "hockey" ? "var(--hockey)" : "var(--fencing)"}` }}
                >
                  <SportIcon sport={athlete.sport} className="h-5 w-5" />
                  <div className="flex-1">
                    <div className="font-semibold">{athlete.name}</div>
                    <div className="text-xs text-[var(--text-secondary)] capitalize">{athlete.sport}</div>
                  </div>
                  <Check className="h-4 w-4 text-[var(--accent)]" />
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {athletes.data?.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => setAthleteId(a.id)}
                      className={`surface flex items-center gap-3 p-4 text-left transition-colors ${
                        athleteId === a.id ? "ring-2 ring-[var(--accent)]" : "hover:bg-[var(--bg-elevated)]"
                      }`}
                      style={{ borderLeft: `4px solid ${a.sport === "hockey" ? "var(--hockey)" : "var(--fencing)"}` }}
                    >
                      <SportIcon sport={a.sport} className="h-5 w-5" />
                      <div className="flex-1">
                        <div className="font-semibold">{a.name}</div>
                        <div className="text-xs text-[var(--text-secondary)] capitalize">{a.sport}</div>
                      </div>
                      {athleteId === a.id && <Check className="h-4 w-4 text-[var(--accent)]" />}
                    </button>
                  ))}
                </div>
              )}

              {athleteId && (
                <>
                  <div className="metric-label mt-4">Session type</div>
                  <Select value={sessionType} onValueChange={setSessionType}>
                    <SelectTrigger className="w-full border-[var(--border-default)] bg-[var(--bg-elevated)] focus:ring-[var(--accent)] focus:ring-1">
                      <SelectValue placeholder="Select session type…" />
                    </SelectTrigger>
                    <SelectContent className="bg-[var(--bg-elevated)] border-[var(--border-default)]">
                      {["Bout", "Drill Session", "Footwork", "Sparring", "Competition"].map((opt) => (
                        <SelectItem key={opt} value={opt} className="focus:bg-[var(--bg-hover)] focus:text-[var(--text-primary)]">
                          {opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="metric-label mt-4">Session name <span className="text-[var(--text-muted)] normal-case">(optional)</span></div>
                  <input
                    value={sessionName}
                    onChange={(e) => setSessionName(e.target.value)}
                    placeholder="e.g. Tuesday open bout vs Marco"
                    className="w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                  />
                  <div className="metric-label mt-4">Session date</div>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal border-[var(--border-default)] bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]",
                          !sessionDate && "text-[var(--text-muted)]"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {sessionDate ? format(sessionDate, "PPP") : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 bg-[var(--bg-elevated)] border-[var(--border-default)]" align="start">
                      <Calendar
                        mode="single"
                        selected={sessionDate}
                        onSelect={(date) => date && setSessionDate(date)}
                        disabled={(date) => date > new Date()}
                        initialFocus
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </>
              )}

              <div className="flex justify-end">
                <button
                  disabled={!athleteId || !sessionType}
                  onClick={() => setStep(2)}
                  className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[#001813] hover:bg-[var(--accent-dim)] disabled:opacity-50"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {step === 2 && isHockey && (
            <div className="space-y-3">
              <div className="metric-label">Baseline reps</div>
              {hockeyReps.map((r, i) => (
                <div key={i} className="surface flex items-center gap-3 p-3">
                  <div className="metric-label w-10">R{r.rep_number}</div>
                  <input
                    placeholder="10m time (s)"
                    value={r.time_10m}
                    onChange={(e) => setHockeyReps((rs) => rs.map((x, j) => (j === i ? { ...x, time_10m: e.target.value } : x)))}
                    className="flex-1 rounded-md border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                  />
                  <input
                    placeholder="Peak mph"
                    value={r.peak_kmh}
                    onChange={(e) => setHockeyReps((rs) => rs.map((x, j) => (j === i ? { ...x, peak_kmh: e.target.value } : x)))}
                    className="flex-1 rounded-md border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                  />
                  <button
                    onClick={() => setHockeyReps((rs) => rs.filter((_, j) => j !== i))}
                    className="text-[var(--text-muted)] hover:text-[var(--data-negative)]"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button
                onClick={() => setHockeyReps((rs) => [...rs, { rep_number: rs.length + 1, time_10m: "", peak_kmh: "" }])}
                className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-[var(--border-default)] px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]"
              >
                <Plus className="h-4 w-4" /> Add rep
              </button>
              <NavBtns onBack={() => setStep(1)} onNext={() => setStep(3)} />
            </div>
          )}

          {step === 2 && !isHockey && (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Opponent" value={fencingOpponent} onChange={setFencingOpponent} />
                <Field
                  label="Touches scored"
                  type="number"
                  value={String(fencingScore.scored)}
                  onChange={(v) => setFencingScore((s) => ({ ...s, scored: Number(v) }))}
                />
                <Field
                  label="Touches received"
                  type="number"
                  value={String(fencingScore.received)}
                  onChange={(v) => setFencingScore((s) => ({ ...s, received: Number(v) }))}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <div className="metric-label mb-1.5">Tournament / Event <span className="text-[var(--text-muted)] normal-case">(optional)</span></div>
                  <input
                    value={fencingEventName}
                    onChange={(e) => setFencingEventName(e.target.value)}
                    placeholder="e.g. Kaizen Spring Open"
                    className="w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                  />
                </label>
                <label className="block">
                  <div className="metric-label mb-1.5">Bout Type <span className="text-[var(--text-muted)] normal-case">(optional)</span></div>
                  <Select value={fencingBoutType || "none"} onValueChange={(v) => setFencingBoutType(v === "none" ? "" : v)}>
                    <SelectTrigger className="w-full border-[var(--border-default)] bg-[var(--bg-elevated)] focus:ring-[var(--accent)] focus:ring-1">
                      <SelectValue placeholder="Select bout type…" />
                    </SelectTrigger>
                    <SelectContent className="bg-[var(--bg-elevated)] border-[var(--border-default)]">
                      <SelectItem value="none" className="focus:bg-[var(--bg-hover)] focus:text-[var(--text-primary)]">None</SelectItem>
                      <SelectItem value="pool" className="focus:bg-[var(--bg-hover)] focus:text-[var(--text-primary)]">Pool</SelectItem>
                      <SelectItem value="de" className="focus:bg-[var(--bg-hover)] focus:text-[var(--text-primary)]">DE</SelectItem>
                    </SelectContent>
                  </Select>
                </label>
              </div>

              <NavBtns onBack={() => setStep(1)} onNext={() => setStep(3)} />
            </div>
          )}

          {step === 3 && (
            <div className="surface space-y-3 p-6">
              <div className="metric-label">Summary</div>
              <Row k="Athlete" v={athlete?.name ?? ""} />
              <Row k="Sport" v={athlete?.sport ?? ""} />
              <Row k="Session type" v={sessionType} />
              {sessionName.trim() && <Row k="Name" v={sessionName.trim()} />}
              <Row k="Date" v={sessionDate ? format(sessionDate, "PPP") : ""} />
              {isHockey && <Row k="Reps" v={String(hockeyReps.length)} />}
              {!isHockey && <Row k="Score" v={`${fencingScore.scored} - ${fencingScore.received}`} />}
              
              <div className="flex justify-between pt-3">
                <button onClick={() => setStep(2)} className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                  ← Back
                </button>
                <button
                  disabled={saving}
                  onClick={save}
                  className="rounded-md bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-[#001813] hover:bg-[var(--accent-dim)] disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save session"}
                </button>
              </div>
            </div>
          )}
        </div>
      </AppShell>
    </RequireAuth>
  );
}

function Field({ label, type = "text", value, onChange }: { label: string; type?: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <div className="metric-label mb-1.5">{label}</div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
      />
    </label>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between border-b border-[var(--border-subtle)] py-2 text-sm">
      <span className="text-[var(--text-secondary)]">{k}</span>
      <span className="font-medium capitalize">{v}</span>
    </div>
  );
}

function NavBtns({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  return (
    <div className="flex justify-between pt-2">
      <button onClick={onBack} className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
        ← Back
      </button>
      <button onClick={onNext} className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[#001813] hover:bg-[var(--accent-dim)]">
        Continue
      </button>
    </div>
  );
}
