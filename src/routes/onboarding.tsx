import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Activity, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { SportIcon } from "@/components/SportIcon";
import { inToCm, lbToKg } from "@/lib/units";

export const Route = createFileRoute("/onboarding")({
  component: OnboardingPage,
  ssr: false,
  head: () => ({ meta: [{ title: "Welcome — Ascesa Analytics" }] }),
});

type Sport = "hockey" | "fencing";

type AthleteForm = {
  name: string;
  sport: Sport;
  age: string;
  height_cm: string;
  weight_kg: string;
  position: string;
  team: string;
  weapon: string;
  club: string;
};

const empty = (sport: Sport = "hockey"): AthleteForm => ({
  name: "",
  sport,
  age: "",
  height_cm: "",
  weight_kg: "",
  position: "Defense",
  team: "",
  weapon: "Épée",
  club: "",
});

function OnboardingPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [forms, setForms] = useState<AthleteForm[]>([empty()]);
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  const update = (i: number, patch: Partial<AthleteForm>) =>
    setForms((f) => f.map((a, idx) => (idx === i ? { ...a, ...patch } : a)));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setErr("");
    setSaving(true);
    const rows = forms.map((f) => ({
      user_id: user.id,
      name: f.name.trim(),
      sport: f.sport,
      age: f.age ? Number(f.age) : null,
      height_cm: f.height_cm ? inToCm(Number(f.height_cm)) : null,
      weight_kg: f.weight_kg ? lbToKg(Number(f.weight_kg)) : null,
      position: f.sport === "hockey" ? f.position || null : null,
      team: f.sport === "hockey" ? f.team || null : null,
      weapon: f.sport === "fencing" ? f.weapon || null : null,
      club: f.sport === "fencing" ? f.club || null : null,
    }));
    const { error } = await supabase.from("athletes").insert(rows);
    setSaving(false);
    if (error) return setErr(error.message);
    navigate({ to: "/" });
  };

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-8 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--accent-glow)] ring-1 ring-[var(--accent)]/40">
            <Activity className="h-5 w-5 text-[var(--accent)]" />
          </div>
          <div>
            <div className="text-lg font-bold tracking-tight">Welcome to Ascesa Analytics</div>
            <div className="text-xs text-[var(--text-secondary)]">
              Tell us about your athlete to get started.
            </div>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-5">
          {forms.map((f, i) => (
            <AthleteCard
              key={i}
              index={i}
              form={f}
              onChange={(patch) => update(i, patch)}
              onRemove={forms.length > 1 ? () => setForms((arr) => arr.filter((_, idx) => idx !== i)) : undefined}
            />
          ))}

          {forms.length < 2 && (
            <button
              type="button"
              onClick={() => setForms((f) => [...f, empty()])}
              className="inline-flex items-center gap-2 rounded-md border border-dashed border-[var(--border-default)] px-4 py-2.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
            >
              <Plus className="h-4 w-4" /> Add second athlete
            </button>
          )}

          {err && (
            <div className="rounded-md bg-[var(--data-negative)]/10 px-3 py-2 text-xs text-[var(--data-negative)]">
              {err}
            </div>
          )}

          <button
            type="submit"
            disabled={saving || forms.some((f) => !f.name.trim())}
            className="w-full rounded-md bg-[var(--accent)] py-3 text-sm font-semibold text-[#001813] hover:bg-[var(--accent-dim)] disabled:opacity-50"
          >
            {saving ? "Saving…" : "Let's go"}
          </button>
        </form>
      </div>
    </div>
  );
}

function AthleteCard({
  index,
  form,
  onChange,
  onRemove,
}: {
  index: number;
  form: AthleteForm;
  onChange: (patch: Partial<AthleteForm>) => void;
  onRemove?: () => void;
}) {
  const accent = form.sport === "hockey" ? "var(--hockey)" : "var(--fencing)";
  return (
    <div className="surface p-6" style={{ borderLeft: `4px solid ${accent}` }}>
      <div className="mb-4 flex items-center justify-between">
        <div className="metric-label">Athlete {index + 1}</div>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="text-[var(--text-muted)] hover:text-[var(--data-negative)]"
            aria-label="Remove athlete"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="space-y-4">
        <Field label="Name">
          <input
            value={form.name}
            onChange={(e) => onChange({ name: e.target.value })}
            required
            className={inputCls}
          />
        </Field>

        <div>
          <div className="metric-label mb-1.5">Sport</div>
          <div className="inline-flex rounded-lg bg-[var(--bg-elevated)] p-1 ring-1 ring-[var(--border-default)]">
            <SportPill
              active={form.sport === "hockey"}
              sport="hockey"
              label="Hockey"
              onClick={() => onChange({ sport: "hockey" })}
            />
            <SportPill
              active={form.sport === "fencing"}
              sport="fencing"
              label="Fencing"
              onClick={() => onChange({ sport: "fencing" })}
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Field label="Age">
            <input
              type="number"
              min={4}
              max={99}
              value={form.age}
              onChange={(e) => onChange({ age: e.target.value })}
              className={inputCls}
            />
          </Field>
          <Field label="Height (in)">
            <input
              type="number"
              step="0.1"
              value={form.height_cm}
              onChange={(e) => onChange({ height_cm: e.target.value })}
              className={inputCls}
            />
          </Field>
          <Field label="Weight (lb)">
            <input
              type="number"
              step="0.1"
              value={form.weight_kg}
              onChange={(e) => onChange({ weight_kg: e.target.value })}
              className={inputCls}
            />
          </Field>
        </div>

        {form.sport === "hockey" ? (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Position">
              <select
                value={form.position}
                onChange={(e) => onChange({ position: e.target.value })}
                className={inputCls}
              >
                <option>Defense</option>
                <option>Forward</option>
                <option>Goalie</option>
              </select>
            </Field>
            <Field label="Team">
              <input
                value={form.team}
                onChange={(e) => onChange({ team: e.target.value })}
                className={inputCls}
              />
            </Field>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Weapon">
              <select
                value={form.weapon}
                onChange={(e) => onChange({ weapon: e.target.value })}
                className={inputCls}
              >
                <option>Épée</option>
                <option>Foil</option>
                <option>Sabre</option>
              </select>
            </Field>
            <Field label="Club">
              <input
                value={form.club}
                onChange={(e) => onChange({ club: e.target.value })}
                className={inputCls}
              />
            </Field>
          </div>
        )}
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="metric-label mb-1.5">{label}</div>
      {children}
    </label>
  );
}

function SportPill({
  active,
  sport,
  label,
  onClick,
}: {
  active: boolean;
  sport: Sport;
  label: string;
  onClick: () => void;
}) {
  const color = sport === "hockey" ? "var(--hockey)" : "var(--fencing)";
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-md px-4 py-1.5 text-sm font-medium transition-colors"
      style={
        active
          ? { background: color, color: "#001813" }
          : { color: "var(--text-secondary)" }
      }
    >
      <SportIcon sport={sport} className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}
