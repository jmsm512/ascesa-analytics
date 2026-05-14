import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { Activity, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const router = useRouter();
  const navigate = useNavigate();

  const logout = async () => {
    await supabase.auth.signOut();
    router.invalidate();
    navigate({ to: "/login" });
  };

  const initials = user?.email?.slice(0, 2).toUpperCase() ?? "AS";

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-[var(--border-subtle)] bg-[var(--bg-base)]/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--accent-glow)] ring-1 ring-[var(--accent)]/30">
              <Activity className="h-4 w-4 text-[var(--accent)]" />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-bold tracking-tight">Ascesa</div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-secondary)]">
                Analytics
              </div>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <div className="hidden text-right text-xs text-[var(--text-secondary)] sm:block">
              {user?.email}
            </div>
            <div className="grid h-9 w-9 place-items-center rounded-full bg-[var(--bg-elevated)] text-xs font-semibold ring-1 ring-[var(--border-default)]">
              {initials}
            </div>
            <button
              onClick={logout}
              className="grid h-9 w-9 place-items-center rounded-md text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
              aria-label="Log out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
    </div>
  );
}
