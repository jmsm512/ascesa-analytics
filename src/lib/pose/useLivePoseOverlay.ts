// Real-time MediaPipe Pose overlay on a playing <video>.
// - Processes every 3rd frame to keep playback smooth
// - Uses requestVideoFrameCallback when available, falls back to rAF
// - Highlights left/right ankles with larger accent dots
// - Buffers per-frame ankle speeds and flushes to the sport-specific table

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { loadPose, CONNECTIONS, type Landmark } from "./runPoseAnalysis";

export type LiveOverlayOpts = {
  videoRef: React.RefObject<HTMLVideoElement>;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  videoSrc: string | null;
  videoId: string | null;
  sport: "hockey" | "fencing";
  color: string; // skeleton accent
  enabled: boolean;
};

export type LiveOverlayState = {
  ready: boolean;
  formatError: string | null;
  framesProcessed: number;
};

// Sport-specific ankle highlight — bright contrasting color over the skeleton
const ANKLE_COLOR = "#ffffff";

export function useLivePoseOverlay(opts: LiveOverlayOpts): LiveOverlayState {
  const { videoRef, canvasRef, videoSrc, videoId, sport, color, enabled } = opts;
  const [ready, setReady] = useState(false);
  const [formatError, setFormatError] = useState<string | null>(null);
  const [framesProcessed, setFramesProcessed] = useState(0);

  // refs to keep loop closure stable
  const busyRef = useRef(false);
  const frameCounterRef = useRef(0);
  const lastAnklesRef = useRef<{
    t: number;
    left: Landmark | null;
    right: Landmark | null;
  } | null>(null);
  const sampleBufferRef = useRef<
    { t: number; leftSpeed: number; rightSpeed: number; left: Landmark | null; right: Landmark | null }[]
  >([]);
  const flushTimerRef = useRef<number | null>(null);

  // Detect MOV / quicktime up front so we can show a friendly message.
  useEffect(() => {
    if (!videoSrc) { setFormatError(null); return; }
    const isMov = /\.mov(\?|$)/i.test(videoSrc);
    setFormatError(isMov ? "Please convert to MP4 for pose detection" : null);
  }, [videoSrc]);

  // Main detection loop
  useEffect(() => {
    if (!enabled || formatError) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    let cancelled = false;
    let pose: any = null;
    let rafId: number | null = null;
    let vfcId: number | null = null;
    const supportsVFC = typeof (video as any).requestVideoFrameCallback === "function";

    async function init() {
      try {
        pose = await loadPose();
        if (cancelled) return;
        pose.onResults((results: any) => {
          if (cancelled) return;
          drawFrame(results);
          busyRef.current = false;
        });
        setReady(true);
        schedule();
      } catch (e: any) {
        setFormatError(e?.message ?? "Failed to initialize MediaPipe Pose");
      }
    }

    function drawFrame(results: any) {
      const v = videoRef.current;
      const c = canvasRef.current;
      if (!v || !c) return;
      const W = v.videoWidth || c.clientWidth;
      const H = v.videoHeight || c.clientHeight;
      if (c.width !== W) c.width = W;
      if (c.height !== H) c.height = H;
      const ctx = c.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, W, H);

      const lms: Landmark[] | undefined = results?.poseLandmarks;
      if (!lms) return;

      // skeleton
      ctx.lineWidth = Math.max(2, Math.round(W / 500));
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      for (const [a, b] of CONNECTIONS) {
        const pa = lms[a]; const pb = lms[b];
        if (!pa || !pb) continue;
        if ((pa.visibility ?? 1) < 0.4 || (pb.visibility ?? 1) < 0.4) continue;
        ctx.beginPath();
        ctx.moveTo(pa.x * W, pa.y * H);
        ctx.lineTo(pb.x * W, pb.y * H);
        ctx.stroke();
      }
      // generic joint dots
      const dot = Math.max(3, Math.round(W / 400));
      for (let i = 0; i < lms.length; i++) {
        if (i === 27 || i === 28) continue; // ankles drawn separately
        const p = lms[i];
        if ((p.visibility ?? 1) < 0.4) continue;
        ctx.beginPath();
        ctx.arc(p.x * W, p.y * H, dot, 0, Math.PI * 2);
        ctx.fill();
      }
      // highlighted ankles
      const ankleRadius = Math.max(7, Math.round(W / 140));
      ctx.lineWidth = Math.max(2, Math.round(W / 600));
      ctx.strokeStyle = color;
      ctx.fillStyle = ANKLE_COLOR;
      for (const idx of [27, 28]) {
        const p = lms[idx];
        if (!p || (p.visibility ?? 1) < 0.3) continue;
        ctx.beginPath();
        ctx.arc(p.x * W, p.y * H, ankleRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      // record ankle sample / speed
      const left = lms[27] ?? null;
      const right = lms[28] ?? null;
      const t = v.currentTime;
      const prev = lastAnklesRef.current;
      const dt = prev ? Math.max(1 / 60, t - prev.t) : 0;
      // Rough pixel→meter scale via nose↔ankle vertical distance
      const nose = lms[0];
      const ankleY = left && right ? (left.y + right.y) / 2 : (left ?? right)?.y;
      const heightM = sport === "hockey" ? 1.78 : 1.7;
      const span = nose && ankleY != null ? Math.abs(ankleY - nose.y) : 0;
      const scale = span > 0.15 ? heightM / span : heightM / 0.7;

      let leftSpeed = 0;
      let rightSpeed = 0;
      if (prev && dt > 0) {
        if (left && prev.left) {
          const dx = (left.x - prev.left.x) * scale;
          const dy = (left.y - prev.left.y) * scale;
          leftSpeed = Math.hypot(dx, dy) / dt;
        }
        if (right && prev.right) {
          const dx = (right.x - prev.right.x) * scale;
          const dy = (right.y - prev.right.y) * scale;
          rightSpeed = Math.hypot(dx, dy) / dt;
        }
      }
      lastAnklesRef.current = { t, left, right };
      sampleBufferRef.current.push({ t, leftSpeed, rightSpeed, left, right });
      setFramesProcessed((n) => n + 1);
      scheduleFlush();
    }

    async function process() {
      if (cancelled) return;
      const v = videoRef.current;
      if (!v || v.paused || v.ended || busyRef.current) {
        schedule();
        return;
      }
      frameCounterRef.current += 1;
      if (frameCounterRef.current % 3 !== 0) {
        schedule();
        return;
      }
      busyRef.current = true;
      try {
        await pose.send({ image: v });
      } catch (e) {
        busyRef.current = false;
      }
      // schedule() called again from onResults via next tick fallback
      schedule();
    }

    function schedule() {
      if (cancelled) return;
      if (supportsVFC) {
        vfcId = (video as any).requestVideoFrameCallback(() => process());
      } else {
        rafId = requestAnimationFrame(() => process());
      }
    }

    init();

    return () => {
      cancelled = true;
      if (rafId != null) cancelAnimationFrame(rafId);
      if (vfcId != null && (video as any).cancelVideoFrameCallback) {
        (video as any).cancelVideoFrameCallback(vfcId);
      }
      if (flushTimerRef.current != null) {
        window.clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      flushNow();
    };

    function scheduleFlush() {
      if (flushTimerRef.current != null) return;
      flushTimerRef.current = window.setTimeout(() => {
        flushTimerRef.current = null;
        flushNow();
      }, 1500);
    }

    async function flushNow() {
      const buf = sampleBufferRef.current;
      if (!buf.length || !videoId) { sampleBufferRef.current = []; return; }
      const batch = buf.splice(0, buf.length);
      try {
        const { data: u } = await supabase.auth.getUser();
        const userId = u.user?.id;
        if (!userId) return;
        const rows = batch.map((s, i) => ({
          user_id: userId,
          video_id: videoId,
          timestamp_seconds: Number(s.t.toFixed(3)),
          left_speed_ms: Number(s.leftSpeed.toFixed(3)),
          right_speed_ms: Number(s.rightSpeed.toFixed(3)),
          ...(sport === "hockey"
            ? { step_number: i + 1 }
            : {
                rep_number: i + 1,
                attack_speed_ms: Number(Math.max(s.leftSpeed, s.rightSpeed).toFixed(3)),
              }),
        }));
        const table = sport === "hockey" ? "hockey_step_data" : "fencing_sensor_reps";
        await supabase.from(table).insert(rows as any);
      } catch {
        // best-effort: swallow to avoid breaking playback
      }
    }
  }, [enabled, formatError, videoSrc, videoId, sport, color, videoRef, canvasRef]);

  return { ready, formatError, framesProcessed };
}
