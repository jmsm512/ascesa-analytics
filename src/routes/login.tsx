import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import logoUrl from "@/assets/ascesa-logo.png";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({ meta: [{ title: "Sign in — Ascesa Analytics" }] }),
});

function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return setErr(error.message);
    navigate({ to: "/" });
  };

  const google = async () => {
    setErr("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) setErr(error.message);
  };

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-3">
          <img src={logoUrl} alt="Ascesa Analytics" className="h-12 w-12 object-contain" />
          <div>
            <div className="text-lg font-bold tracking-tight">Ascesa Analytics</div>
            <div className="text-xs text-[var(--text-secondary)]">Athlete performance, quantified.</div>
          </div>
        </div>

        <div className="surface p-6">
          <h1 className="mb-1 text-xl font-semibold">Sign in</h1>
          <p className="mb-6 text-sm text-[var(--text-secondary)]">Welcome back to your dashboard.</p>

          <form onSubmit={submit} className="space-y-3">
            <Field label="Email" type="email" value={email} onChange={setEmail} />
            <Field label="Password" type="password" value={password} onChange={setPassword} />
            {err && <div className="rounded-md bg-[var(--data-negative)]/10 px-3 py-2 text-xs text-[var(--data-negative)]">{err}</div>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-[var(--accent)] py-2.5 text-sm font-semibold text-[#001813] hover:bg-[var(--accent-dim)] disabled:opacity-50"
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <div className="my-4 flex items-center gap-3 text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
            <div className="h-px flex-1 bg-[var(--border-subtle)]" /> or <div className="h-px flex-1 bg-[var(--border-subtle)]" />
          </div>

          <button
            onClick={google}
            className="w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-elevated)] py-2.5 text-sm font-medium hover:bg-[var(--bg-hover)]"
          >
            Continue with Google
          </button>

          <p className="mt-6 text-center text-xs text-[var(--text-secondary)]">
            New here?{" "}
            <Link to="/signup" className="text-[var(--accent)] hover:underline">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function Field({ label, type, value, onChange }: { label: string; type: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <div className="metric-label mb-1.5">{label}</div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        className="w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
      />
    </label>
  );
}
