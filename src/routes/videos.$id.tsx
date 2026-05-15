import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell } from "@/components/AppShell";
import { getVideo } from "@/lib/data";
import { ArrowLeft, Sparkles, Play } from "lucide-react";

export const Route = createFileRoute("/videos/$id")({
  component: VideoPage,
});

function VideoPage() {
  const { id } = Route.useParams();
  const v = useQuery({ queryKey: ["video", id], queryFn: () => getVideo(id) });
  const [selected, setSelected] = useState(0);
  const [analyzing, setAnalyzing] = useState(false);

  const video = v.data;
  const frames = Array.from({ length: 8 }).map((_, i) => i);

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
            onClick={async () => {
              if (!video) return;
              const athlete = (video as any).athletes;
              if (!athlete) {
                console.error("Video missing athlete data");
                return;
              }
              setAnalyzing(true);
              try {
                const res = await fetch(
                  "https://yixcufjaoqofcloccyix.supabase.co/functions/v1/analyze-video",
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      video_id: video.id,
                      sport: athlete.sport,
                      athlete_name: athlete.name,
                      age: athlete.age,
                    }),
                  },
                );
                if (!res.ok) {
                  const err = await res.text();
                  console.error("analyze-video failed:", res.status, err);
                } else {
                  await v.refetch();
                }
              } catch (err) {
                console.error("analyze-video error:", err);
              } finally {
                setAnalyzing(false);
              }
            }}
            disabled={analyzing}
            className="inline-flex items-center gap-2 rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[#001813] hover:bg-[var(--accent-dim)] disabled:opacity-60"
          >
            <Sparkles className="h-4 w-4" /> {analyzing ? "Analyzing…" : "Analyze video"}
          </button>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
          <div>
            <div className="surface relative aspect-video overflow-hidden bg-black">
              <div className="grid h-full place-items-center text-[var(--text-muted)]">
                <Play className="h-16 w-16" />
              </div>
              <div className="absolute inset-x-0 bottom-0 flex items-center gap-3 bg-gradient-to-t from-black/80 to-transparent p-4 text-xs text-white/80">
                <div className="h-1 flex-1 rounded bg-white/20">
                  <div className="h-full w-1/3 rounded bg-[var(--accent)]" />
                </div>
                <span className="tabular-nums">00:32 / 01:48</span>
              </div>
            </div>

            <div className="mt-3 flex gap-2 overflow-x-auto scrollbar-thin pb-2">
              {frames.map((f) => (
                <button
                  key={f}
                  onClick={() => setSelected(f)}
                  className={`relative h-16 w-28 shrink-0 overflow-hidden rounded-md border-2 ${
                    selected === f ? "border-[var(--accent)]" : "border-transparent"
                  }`}
                >
                  <div className="h-full w-full bg-gradient-to-br from-[var(--bg-elevated)] to-[var(--bg-hover)]" />
                  <span className="absolute bottom-0.5 left-1 text-[9px] font-mono text-white/70">0:{String(f * 12).padStart(2, "0")}</span>
                </button>
              ))}
            </div>

            <div className="surface mt-4 p-4 text-xs text-[var(--text-secondary)]">
              Status: <span className="text-[var(--text-primary)]">{analyzing ? "Processing" : (video?.status ?? "pending")}</span>
              {analyzing && <span className="ml-2 text-[var(--accent)]">· running pose detection…</span>}
            </div>
          </div>

          <div className="surface p-5">
            <div className="metric-label">Keyframe {selected + 1}</div>
            <div className="mt-3 aspect-square rounded-lg bg-gradient-to-br from-[var(--bg-elevated)] to-[var(--bg-hover)] grid place-items-center">
              <div className="text-center">
                <div className="text-xs text-[var(--text-muted)]">Pose overlay</div>
                <div className="mt-1 text-[10px] text-[var(--text-muted)]">(skeleton drawn over athlete)</div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <Metric label="Knee angle" value="142°" />
              <Metric label="Hip angle" value="98°" />
              <Metric label="Stride len." value="1.84m" />
              <Metric label="Cadence" value="4.2/s" />
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
              ) : (
                <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
                  Strong forward lean and knee drive on initial steps. Consider extending arm swing through hips for a longer push phase.
                </p>
              )}
              <div className="mt-3 text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                Analysis powered by Claude AI
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
