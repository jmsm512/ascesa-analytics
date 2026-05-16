import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type SessionLite = {
  id: string;
  athlete_id: string;
  session_date: string;
  location: string | null;
  notes: string | null;
  session_type?: string | null;
  name?: string | null;
};

type FencingFields = {
  fencingSessionId: string;
  weapon: string | null;
  opponent: string | null;
  touches_scored: number;
  touches_received: number;
};

export function SessionEditDelete({
  session,
  fencing,
  onSaved,
}: {
  session: SessionLite;
  fencing?: FencingFields;
  onSaved?: () => void;
}) {
  const navigate = useNavigate();
  const [editOpen, setEditOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [date, setDate] = useState(session.session_date.slice(0, 10));
  const [sessionType, setSessionType] = useState(session.session_type ?? "");
  const [location, setLocation] = useState(session.location ?? "");
  const [notes, setNotes] = useState(session.notes ?? "");
  const [weapon, setWeapon] = useState(fencing?.weapon ?? "");
  const [opponent, setOpponent] = useState(fencing?.opponent ?? "");
  const [scored, setScored] = useState(String(fencing?.touches_scored ?? 0));
  const [received, setReceived] = useState(String(fencing?.touches_received ?? 0));

  async function save() {
    setSaving(true);
    setErr(null);
    try {
      const { error: e1 } = await supabase
        .from("sessions")
        .update({
          session_date: new Date(date).toISOString(),
          session_type: sessionType || (session.session_type ?? "bout"),
          location: location || null,
          notes: notes || null,
        })
        .eq("id", session.id);
      if (e1) throw e1;
      if (fencing) {
        const s = Number(scored) || 0;
        const r = Number(received) || 0;
        const { error: e2 } = await supabase
          .from("fencing_sessions")
          .update({
            weapon: weapon || null,
            opponent: opponent || null,
            touches_scored: s,
            touches_received: r,
            result: s > r ? "win" : s < r ? "loss" : "draw",
          })
          .eq("id", fencing.fencingSessionId);
        if (e2) throw e2;
      }
      setEditOpen(false);
      onSaved?.();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function destroy() {
    setDeleting(true);
    try {
      if (fencing) {
        await supabase.from("fencing_actions").delete().eq("fencing_session_id", fencing.fencingSessionId);
        await supabase.from("fencing_sensor_reps").delete().eq("fencing_session_id", fencing.fencingSessionId);
        await supabase.from("fencing_sessions").delete().eq("id", fencing.fencingSessionId);
      } else {
        const { data: hss } = await supabase
          .from("hockey_sprint_sessions")
          .select("id")
          .eq("session_id", session.id);
        const hssIds = (hss ?? []).map((x: any) => x.id);
        if (hssIds.length) {
          const { data: reps } = await supabase
            .from("hockey_sprint_reps")
            .select("id")
            .in("hockey_session_id", hssIds);
          const repIds = (reps ?? []).map((x: any) => x.id);
          if (repIds.length) await supabase.from("hockey_step_data").delete().in("rep_id", repIds);
          await supabase.from("hockey_sprint_reps").delete().in("hockey_session_id", hssIds);
          await supabase.from("hockey_sprint_sessions").delete().in("id", hssIds);
        }
      }
      await supabase.from("videos").delete().eq("session_id", session.id);
      await supabase.from("sessions").delete().eq("id", session.id);
      navigate({ to: "/athletes/$id", params: { id: session.athlete_id } });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setEditOpen(true)}
          className="border-[var(--border-default)] bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)]"
        >
          <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setDelOpen(true)}
          className="border-[var(--border-default)] bg-[var(--bg-elevated)] text-[var(--data-negative)] hover:bg-[var(--bg-hover)] hover:text-[var(--data-negative)]"
        >
          <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete
        </Button>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="bg-[var(--bg-elevated)] border-[var(--border-default)]">
          <DialogHeader>
            <DialogTitle>Edit session</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <Label>Session type</Label>
              <Input value={sessionType} onChange={(e) => setSessionType(e.target.value)} placeholder="bout, drill, footwork…" />
            </div>
            <div>
              <Label>Location</Label>
              <Input value={location} onChange={(e) => setLocation(e.target.value)} />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
            </div>
            {fencing && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Weapon</Label>
                    <Input value={weapon} onChange={(e) => setWeapon(e.target.value)} />
                  </div>
                  <div>
                    <Label>Opponent</Label>
                    <Input value={opponent} onChange={(e) => setOpponent(e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Touches scored</Label>
                    <Input type="number" value={scored} onChange={(e) => setScored(e.target.value)} />
                  </div>
                  <div>
                    <Label>Touches received</Label>
                    <Input type="number" value={received} onChange={(e) => setReceived(e.target.value)} />
                  </div>
                </div>
              </>
            )}
            {err && <div className="text-xs text-[var(--data-negative)]">{err}</div>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button
              onClick={save}
              disabled={saving}
              className="bg-[var(--accent)] text-[#001813] hover:bg-[var(--accent-dim)]"
            >
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={delOpen} onOpenChange={setDelOpen}>
        <DialogContent className="bg-[var(--bg-elevated)] border-[var(--border-default)]">
          <DialogHeader>
            <DialogTitle>Delete session?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-[var(--text-secondary)]">
            This permanently deletes the session and all related data (reps, actions, tagged
            videos, sensor data). This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDelOpen(false)}>Cancel</Button>
            <Button
              onClick={destroy}
              disabled={deleting}
              className="bg-[var(--data-negative)] text-white hover:opacity-90"
            >
              {deleting ? "Deleting…" : "Delete session"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
