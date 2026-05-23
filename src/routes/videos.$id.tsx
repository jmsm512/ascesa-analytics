import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell } from "@/components/AppShell";
import { PoseOverlay } from "@/components/PoseOverlay";
import { getVideo } from "@/lib/data";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Sparkles } from "lucide-react";

export const Route = createFileRoute("/videos/$id")({
  component: VideoPage,
});

function VideoPage() {
  const { id } = Route.useParams();
  const v = useQuery({ queryKey: ["video", id], queryFn: () => getVideo(id) });
  const feedback = useQuery({
    queryKey: ["video-feedback", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("video_ai_feedback")
        .select("*")
        .eq("video_id", id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);

  const video = v.data as any;
  const athlete = video?.athletes;
  const sport: "hockey" | "fencing" = athlete?.sport === "fencing" ? "fencing" : "hockey";

  // Resolve a signed URL for the stored video
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!video?.video_url) return;
      const path: string = video.video_url;
      // If it's already a full URL just use it; otherwise sign the storage path
      if (path.startsWith("http")) {
        if (!cancelled) setSignedUrl(path);
        return;
      }
      const { data } = await supabase.storage.from("videos").createSignedUrl(path, 60 * 60);
      if (!cancelled) setSignedUrl(data?.signedUrl ?? null);
    })();
    return () => { cancelled = true; };
  }, [video?.video_url]);

  async function handleAnalyze() {
    if (!video) return;
    if (!athlete) { toast.error("Video is missing athlete data"); return; }
    const videoEl = videoRef.current;
    const canvasEl = canvasRef.current;
    if (!videoEl || !canvasEl) { toast.error("Video element not ready"); return; }
    if (!signedUrl) { toast.error("Video file not available"); return; }

    setAnalyzing(true);
    setAnalyzeError(null);
    setProgress(0);
    setSamples(null);

    try {
      setPhase("Detecting pose…");
      const speeds = await runPoseAnalysis({
        video: videoEl,
        canvas: canvasEl,
        color: skeletonColor,
        fps: 6,
        athleteHeightM: athlete.sport === "hockey" ? 1.78 : 1.7,
        onProgress: (p) => setProgress(p),
      });
      setSamples(speeds);

      // Persist per-frame ankle speed samples
      setPhase("Saving frames…");
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (userId && speeds.length) {
        const rows = speeds.map((s, i) => ({
          user_id: userId,
          video_id: video.id,
          timestamp_seconds: Number(s.t.toFixed(3)),
          left_speed_ms: Number(s.leftSpeed.toFixed(3)),
          right_speed_ms: Number(s.rightSpeed.toFixed(3)),
          ...(sport === "hockey"
            ? { step_number: i + 1 }
            : { rep_number: i + 1, attack_speed_ms: Number(Math.max(s.leftSpeed, s.rightSpeed).toFixed(3)) }),
        }));
        const table = sport === "hockey" ? "hockey_step_data" : "fencing_sensor_reps";
        // Clear previous samples for this video, then insert
        await supabase.from(table).delete().eq("video_id", video.id);
        const { error } = await supabase.from(table).insert(rows as any);
        if (error) throw error;
      }

      // Trigger AI feedback via existing edge function
      setPhase("Generating AI feedback…");
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
      const res = await fetch(
        "https://yixcufjaoqofcloccyix.supabase.co/functions/v1/analyze-video",
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${anonKey}`, apikey: anonKey },
          body: JSON.stringify({ video_id: video.id, sport: athlete.sport, athlete_name: athlete.name, age: athlete.age }),
        },
      );
      if (!res.ok) {
        const t = await res.text();
        let msg = `AI feedback failed (${res.status})`;
        try { const j = JSON.parse(t); if (j?.error) msg = j.error; } catch { if (t) msg = t.slice(0, 200); }
        toast.warning(msg);
      }

      await Promise.all([v.refetch(), feedback.refetch()]);
      toast.success("Pose analysis complete");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Analysis failed";
      setAnalyzeError(msg);
      toast.error(msg);
    } finally {
      setAnalyzing(false);
      setPhase("");
    }
  }

  const peakLeft = samples?.reduce((m, s) => Math.max(m, s.leftSpeed), 0) ?? 0;
  const peakRight = samples?.reduce((m, s) => Math.max(m, s.rightSpeed), 0) ?? 0;

  return (
    <RequireAuth>
      <AppShell>
        <Link to="/" className="inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </Link>

        <div className="mt-4 flex items-end justify-between">
          <div>
            <div className="metric-label mb-1">Video Analysis</div>
            <h1 className="text-2xl font-bold tracking-tight">{video?.label ?? "Untitled clip"}</h1>
          </div>
          <button
            onClick={handleAnalyze}
            disabled={analyzing || !signedUrl}
            className="inline-flex items-center gap-2 rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[#001813] hover:bg-[var(--accent-dim)] disabled:opacity-60"
          >
            <Sparkles className="h-4 w-4" /> {analyzing ? "Analyzing…" : "Analyze video"}
          </button>
        </div>

        {live.formatError && (
          <div className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
            {live.formatError}
          </div>
        )}

        {analyzeError && (
          <div className="mt-3 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            {analyzeError}
          </div>
        )}

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
          <div>
            <div className="surface relative aspect-video overflow-hidden bg-black">
              {signedUrl ? (
                <div style={{ position: "relative", width: "100%", height: "100%" }}>
                  <video
                    ref={videoRef}
                    src={signedUrl}
                    controls
                    playsInline
                    crossOrigin="anonymous"
                    className="h-full w-full object-contain"
                  />
                  <canvas
                    ref={canvasRef}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      height: "100%",
                      zIndex: 50,
                      pointerEvents: "none",
                    }}
                  />
                </div>
              ) : (
                <div className="grid h-full place-items-center text-[var(--text-muted)]">Loading video…</div>
              )}
            </div>

            <div className="surface mt-3 overflow-hidden">
              <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2 text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                <span>Debug · Pose skeleton mirror</span>
                <span style={{ color: "#00e5b4" }}>{live.framesProcessed} frames</span>
              </div>
              <div className="relative aspect-video bg-[#0a0a0a]">
                <canvas
                  ref={debugCanvasRef}
                  className="absolute inset-0 h-full w-full object-contain"
                />
              </div>
            </div>




            {analyzing && (
              <div className="surface mt-3 p-3 text-xs text-[var(--text-secondary)]">
                <div className="mb-2 flex items-center justify-between">
                  <span>{phase}</span>
                  <span className="tabular-nums" style={{ color: skeletonColor }}>{Math.round(progress * 100)}%</span>
                </div>
                <div className="h-1 rounded bg-[var(--bg-hover)]">
                  <div
                    className="h-full rounded transition-all"
                    style={{ width: `${progress * 100}%`, background: skeletonColor }}
                  />
                </div>
              </div>
            )}

            <div className="surface mt-4 p-4 text-xs text-[var(--text-secondary)]">
              Status: <span className="text-[var(--text-primary)]">{analyzing ? "Processing" : (video?.status ?? "pending")}</span>
              {samples && (
                <span className="ml-2" style={{ color: skeletonColor }}>· {samples.length} frames tracked</span>
              )}
            </div>
          </div>

          <div className="surface p-5">
            <div className="metric-label">Pose tracking</div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Metric label="Peak L foot" value={`${peakLeft.toFixed(2)} m/s`} />
              <Metric label="Peak R foot" value={`${peakRight.toFixed(2)} m/s`} />
              <Metric label="Frames" value={String(samples?.length ?? 0)} />
              <Metric label="Sport" value={sport} />
            </div>

            <div className="mt-5">
              <div className="metric-label mb-2 flex items-center gap-1.5">
                <Sparkles className="h-3 w-3" /> AI Feedback
              </div>
              {analyzing ? (
                <div className="space-y-2">
                  <div className="h-3 animate-pulse rounded bg-[var(--bg-hover)]" />
                  <div className="h-3 w-4/5 animate-pulse rounded bg-[var(--bg-hover)]" />
                  <div className="h-3 w-2/3 animate-pulse rounded bg-[var(--bg-hover)]" />
                </div>
              ) : feedback.data && feedback.data.length > 0 ? (
                <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                  {feedback.data.map((row: any) => {
                    let parsed: any = null;
                    try { parsed = JSON.parse(row.feedback); } catch {}
                    return (
                      <div key={row.id} className="rounded-md bg-[var(--bg-elevated)] p-2.5 text-xs text-[var(--text-secondary)]">
                        {parsed?.frame_index != null && (
                          <div className="metric-label mb-1">Frame {parsed.frame_index}</div>
                        )}
                        <p className="leading-relaxed">{parsed?.analysis ?? row.feedback}</p>
                        {Array.isArray(parsed?.actionable_cues) && parsed.actionable_cues.length > 0 && (
                          <ul className="mt-2 list-disc pl-4 space-y-0.5">
                            {parsed.actionable_cues.map((c: string, i: number) => <li key={i}>{c}</li>)}
                          </ul>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs leading-relaxed text-[var(--text-muted)]">
                  No analysis yet. Click "Analyze video" to run pose tracking and generate AI feedback.
                </p>
              )}
              <div className="mt-3 text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                Pose: MediaPipe · Feedback: Claude AI
              </div>
            </div>
          </div>
        </div>
      </AppShell>
    </RequireAuth>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-[var(--bg-elevated)] px-3 py-2">
      <div className="text-[9px] uppercase tracking-wider text-[var(--text-muted)]">{label}</div>
      <div className="text-sm font-semibold tabular-nums">{value}</div>
    </div>
  );
}
