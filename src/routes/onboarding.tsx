import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import logoUrl from "@/assets/ascesa-logo.png";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { SportIcon } from "@/components/SportIcon";
import { inToCm, lbToKg } from "@/lib/units";
import { SPORTS, SPORT_KEYS, type SportKey } from "@/lib/sports";

export const Route = createFileRoute("/onboarding")({
  component: OnboardingPage,
  ssr: false,
  head: () => ({ meta: [{ title: "Welcome — Ascesa Analytics" }] }),
});

type AthleteForm = {
  name: string;
  sport: SportKey;
  age: string;
  height_in: string;
  weight_lb: string;
  role: string;
  group: string;
  fencing_tracker_url: string;
};

const empty = (sport: SportKey = "hockey"): AthleteForm => {
  const cfg = SPORTS[sport];
  return {
    name: "",
    sport,
    age: "",
    height_in: "",
    weight_lb: "",
    role: cfg.role.options?.[0] ?? "",
    group: "",
    fencing_tracker_url: "",
  };
};

function OnboardingPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [forms, setForms] = useState<AthleteForm[]>([empty()]);
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  const update = (i: number, patch: Partial<AthleteForm>) =>
    setForms((f) =>
      f.map((a, idx) => {
        if (idx !== i) return a;
        const next = { ...a, ...patch };
        // When the sport changes, reset role to a valid default for that sport.
        if (patch.sport && patch.sport !== a.sport) {
          const cfg = SPORTS[patch.sport];
          next.role = cfg.role.options?.[0] ?? "";
        }
        return next;
      }),
    );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setErr("");
    setSaving(true);
    const rows = forms.map((f) => {
      const cfg = SPORTS[f.sport];
      const row: Record<string, unknown> = {
        user_id: user.id,
        name: f.name.trim(),
        sport: f.sport,
        age: f.age ? Number(f.age) : null,
        height_cm: f.height_in ? inToCm(Number(f.height_in)) : null,
        weight_kg: f.weight_lb ? lbToKg(Number(f.weight_lb)) : null,
        position: null,
        weapon: null,
        team: null,
        club: null,
      };
      row[cfg.role.column] = f.role || null;
      row[cfg.group.column] = f.group || null;
      return row;
    });
    const { error } = await supabase.from("athletes").insert(rows as never);
    setSaving(false);
    if (error) {
      setErr(error.message);
      return;
    }
    // Bust any cached empty athletes list before going to the dashboard,
    // otherwise the dashboard's redirect-on-empty effect bounces us back here.
    await queryClient.invalidateQueries({ queryKey: ["athletes"] });
    await queryClient.invalidateQueries({ queryKey: ["recent"] });
    navigate({ to: "/" });
  };

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-8 flex items-center gap-3">
          <img src={logoUrl} alt="Ascesa Analytics" className="h-12 w-12 object-contain" />
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
              onRemove={
                forms.length > 1
                  ? () => setForms((arr) => arr.filter((_, idx) => idx !== i))
                  : undefined
              }
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
  const cfg = SPORTS[form.sport];
  return (
    <div className="surface p-6" style={{ borderLeft: `4px solid ${cfg.color}` }}>
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

        <Field label="Sport">
          <div className="relative">
            <span
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
              aria-hidden
            >
              <SportIcon sport={form.sport} className="h-3.5 w-3.5" />
            </span>
            <select
              value={form.sport}
              onChange={(e) => onChange({ sport: e.target.value as SportKey })}
              className={`${inputCls} pl-9`}
              style={{ borderColor: cfg.color }}
            >
              {SPORT_KEYS.map((k) => (
                <option key={k} value={k}>
                  {SPORTS[k].label}
                </option>
              ))}
            </select>
          </div>
        </Field>

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
              value={form.height_in}
              onChange={(e) => onChange({ height_in: e.target.value })}
              className={inputCls}
            />
          </Field>
          <Field label="Weight (lb)">
            <input
              type="number"
              step="0.1"
              value={form.weight_lb}
              onChange={(e) => onChange({ weight_lb: e.target.value })}
              className={inputCls}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label={cfg.role.label}>
            {cfg.role.options ? (
              <select
                value={form.role}
                onChange={(e) => onChange({ role: e.target.value })}
                className={inputCls}
              >
                {cfg.role.options.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            ) : (
              <input
                value={form.role}
                onChange={(e) => onChange({ role: e.target.value })}
                className={inputCls}
              />
            )}
          </Field>
          <Field label={cfg.group.label}>
            <input
              value={form.group}
              onChange={(e) => onChange({ group: e.target.value })}
              className={inputCls}
            />
          </Field>
        </div>
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
