import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import { Award, RefreshCw, Link as LinkIcon, ExternalLink, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import type { FencingTrackerData } from "@/lib/data";

type Props = {
  athleteId: string;
  url: string | null;
  data: FencingTrackerData | null;
  updatedAt: string | null;
};

export function FencingTrackerSection({ athleteId, url, data, updatedAt }: Props) {
  const qc = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [draftUrl, setDraftUrl] = useState(url ?? "");
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function saveUrl() {
    setErr(null);
    setSaving(true);
    try {
      const trimmed = draftUrl.trim();
      if (trimmed && !/^https?:\/\/(www\.)?fencingtracker\.com\//i.test(trimmed)) {
        throw new Error("Please paste a fencingtracker.com profile URL.");
      }
      const { error } = await supabase
        .from("athletes")
        .update({ fencing_tracker_url: trimmed || null })
        .eq("id", athleteId);
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["athlete", athleteId] });
      setEditOpen(false);
      if (trimmed) await sync();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function sync() {
    setErr(null);
    setSyncing(true);
    try {
      const { error } = await supabase.functions.invoke("fetch-fencing-tracker", {
        body: { athlete_id: athleteId },
      });
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["athlete", athleteId] });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to sync");
    } finally {
      setSyncing(false);
    }
  }

  // Empty state: no URL set
  if (!url) {
    return (
      <>
        <div className="surface flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[var(--fencing)]/15 text-[var(--fencing)]">
              <LinkIcon className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-medium">Add your FencingTracker profile to see competition history.</div>
              <div className="text-xs text-[var(--text-secondary)]">
                Rating, podium finishes, and recent tournament results.
              </div>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditOpen(true)}
            className="border-[var(--border-default)] bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)]"
          >
            Add profile URL
          </Button>
        </div>
        <UrlDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          draftUrl={draftUrl}
          setDraftUrl={setDraftUrl}
          saving={saving}
          err={err}
          onSave={saveUrl}
        />
      </>
    );
  }

  const ft = data;
  const recent = ft?.recent_results ?? [];
  const podium = ft?.podium_all_time ?? null;

  return (
    <>
      <div className="surface p-5" style={{ borderLeft: "3px solid var(--fencing)" }}>
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <div className="metric-label flex items-center gap-1.5">
              <Award className="h-3.5 w-3.5" /> FencingTracker
            </div>
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-xs text-[var(--text-secondary)] hover:text-[var(--accent)]"
            >
              View public profile <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditOpen(true)}
              className="border-[var(--border-default)] bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)]"
            >
              <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit URL
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={sync}
              disabled={syncing}
              className="border-[var(--border-default)] bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)]"
            >
              <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Syncing…" : "Refresh"}
            </Button>
          </div>
        </div>

        {!ft && (
          <div className="rounded-md border border-dashed border-[var(--border-default)] p-4 text-center text-sm text-[var(--text-secondary)]">
            Click <span className="font-medium text-[var(--text-primary)]">Refresh</span> to pull the latest competition data.
          </div>
        )}

        {ft && (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4">
                <div className="metric-label">Current rating</div>
                <div className="mt-1 flex items-center gap-2">
                  {ft.current_rating ? (
                    <span
                      className="inline-flex items-center rounded-md bg-[var(--fencing)]/20 px-3 py-1 text-lg font-bold tracking-wide text-[var(--fencing)]"
                    >
                      {ft.current_rating}
                    </span>
                  ) : (
                    <span className="text-sm text-[var(--text-muted)]">Unrated</span>
                  )}
                </div>
              </div>
              <div className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4">
                <div className="metric-label">Tournaments</div>
                <div className="metric-num-md mt-1">
                  {ft.total_tournaments != null ? ft.total_tournaments : "—"}
                </div>
                <div className="mt-0.5 text-xs text-[var(--text-secondary)]">All-time entries</div>
              </div>
              <div className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4">
                <div className="metric-label">Podium (all time)</div>
                {podium ? (
                  <div className="mt-1 flex items-baseline gap-3 text-sm font-semibold tabular-nums">
                    <span title="Gold" className="text-amber-400">{podium.gold}🥇</span>
                    <span title="Silver" className="text-slate-300">{podium.silver}🥈</span>
                    <span title="Bronze" className="text-amber-700">{podium.bronze}🥉</span>
                    <span title="Top 8" className="text-[var(--text-secondary)]">T8 {podium.t8}</span>
                  </div>
                ) : (
                  <div className="mt-1 text-sm text-[var(--text-muted)]">—</div>
                )}
              </div>
            </div>

            <div className="mt-4">
              <div className="metric-label mb-2">Recent tournaments</div>
              {recent.length === 0 ? (
                <div className="text-sm text-[var(--text-muted)]">No recorded results yet.</div>
              ) : (
                <div className="divide-y divide-[var(--border-subtle)]">
                  {recent.map((r, i) => (
                    <div key={`${r.date}-${i}`} className="flex items-center gap-3 py-2.5">
                      <div className="w-14 shrink-0 text-xs text-[var(--text-secondary)] tabular-nums">{r.date}</div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{r.tournament}</div>
                        <div className="text-xs text-[var(--text-secondary)] truncate">{r.event}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold tabular-nums">{r.place || "—"}</div>
                        {r.event_class && (
                          <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                            {r.event_class}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-3 flex items-center justify-between text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
              <span>
                {updatedAt
                  ? `Last synced ${formatDistanceToNow(new Date(updatedAt), { addSuffix: true })}`
                  : "Not yet synced"}
              </span>
              {updatedAt && <span>{format(new Date(updatedAt), "PP p")}</span>}
            </div>
          </>
        )}

        {err && <div className="mt-3 text-xs text-[var(--data-negative)]">{err}</div>}
      </div>

      <UrlDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        draftUrl={draftUrl}
        setDraftUrl={setDraftUrl}
        saving={saving}
        err={err}
        onSave={saveUrl}
      />
    </>
  );
}

function UrlDialog({
  open,
  onOpenChange,
  draftUrl,
  setDraftUrl,
  saving,
  err,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  draftUrl: string;
  setDraftUrl: (v: string) => void;
  saving: boolean;
  err: string | null;
  onSave: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[var(--bg-elevated)] border-[var(--border-default)]">
        <DialogHeader>
          <DialogTitle>FencingTracker profile</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Label>Profile URL</Label>
          <Input
            type="url"
            placeholder="https://fencingtracker.com/p/.../Name"
            value={draftUrl}
            onChange={(e) => setDraftUrl(e.target.value)}
          />
          <p className="text-xs text-[var(--text-secondary)]">
            Paste the URL of the fencer's public FencingTracker profile. Leave blank to clear.
          </p>
          {err && <div className="text-xs text-[var(--data-negative)]">{err}</div>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={onSave}
            disabled={saving}
            className="bg-[var(--accent)] text-[#001813] hover:bg-[var(--accent-dim)]"
          >
            {saving ? "Saving…" : "Save & sync"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
