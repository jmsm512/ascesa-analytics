import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth/callback")({
  component: AuthCallback,
  head: () => ({ meta: [{ title: "Signing in… — Ascesa Analytics" }] }),
});

function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState("");

  useEffect(() => {
    // Implicit flow: supabase-js automatically detects tokens from the URL hash.
    // Give it a moment to process, then check for an active session.
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        setError(error.message);
      } else if (data.session) {
        navigate({ to: "/" });
      } else {
        // No session yet — wait for onAuthStateChange which fires when tokens are parsed
        const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
          listener.subscription.unsubscribe();
          if (session) {
            navigate({ to: "/" });
          } else {
            setError("Sign-in failed — no session established.");
          }
        });
      }
    });
  }, []);

  if (error) {
    return (
      <div className="grid min-h-screen place-items-center bg-background px-4">
        <div className="w-full max-w-sm surface p-6 text-center space-y-4">
          <p className="text-sm text-[var(--data-negative)]">{error}</p>
          <a href="/login" className="text-xs text-[var(--accent)] hover:underline">
            Back to sign in
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="grid min-h-screen place-items-center bg-background">
      <div className="text-sm text-[var(--text-secondary)]">Signing you in…</div>
    </div>
  );
}
