// Real-time MediaPipe Pose overlay on a playing <video>.
// Canvas drawing layer rebuilt to use @mediapipe/drawing_utils
// (drawConnectors + drawLandmarks) on a sibling <canvas> sized 100%/100%.

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { loadPose, MP_CDN, type Landmark } from "./runPoseAnalysis";

export type LiveOverlayOpts = {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  debugCanvasRef?: React.RefObject<HTMLCanvasElement | null>;
  videoSrc: string | null;
  videoId: string | null;
  sport: "hockey" | "fencing";
  color: string;
  debugColor?: string;
  enabled: boolean;
};

export type LiveOverlayState = {
  ready: boolean;
  formatError: string | null;
  framesProcessed: number;
};

const DRAWING_UTILS_SRC = "https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils@0.3.1675466124/drawing_utils.js";

function loadDrawingUtils(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as any).drawConnectors && (window as any).drawLandmarks) return resolve();
    if (document.querySelector(`script[src="${DRAWING_UTILS_SRC}"]`)) {
      const check = () => {
        if ((window as any).drawConnectors) resolve();
        else setTimeout(check, 50);
      };
      return check();
    }
    const s = document.createElement("script");
    s.src = DRAWING_UTILS_SRC;
    s.crossOrigin = "anonymous";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load drawing_utils"));
    document.head.appendChild(s);
  });
}

export function useLivePoseOverlay(opts: LiveOverlayOpts): LiveOverlayState {
  const { videoRef, canvasRef, debugCanvasRef, videoSrc, videoId, sport, color, debugColor, enabled } = opts;
  const [ready, setReady] = useState(false);
  const [formatError, setFormatError] = useState<string | null>(null);
  const [framesProcessed, setFramesProcessed] = useState(0);

  const busyRef = useRef(false);
  const frameCounterRef = useRef(0);
  const lastAnklesRef = useRef<{ t: number; left: Landmark | null; right: Landmark | null } | null>(null);
  const sampleBufferRef = useRef<
    { t: number; leftSpeed: number; rightSpeed: number; left: Landmark | null; right: Landmark | null }[]
  >([]);
  const flushTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!videoSrc) { setFormatError(null); return; }
    const isMov = /\.mov(\?|$)/i.test(videoSrc);
    setFormatError(isMov ? "Please convert to MP4 for pose detection" : null);
  }, [videoSrc]);

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

    // POSE_CONNECTIONS comes from the pose module on window
    const POSE_CONNECTIONS = (window as any).POSE_CONNECTIONS;

    async function init() {
      try {
        await loadDrawingUtils();
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
      const c = canvasRef.current;
      const v = videoRef.current;
      if (!c || !v) return;

      const W = v.videoWidth || c.clientWidth;
      const H = v.videoHeight || c.clientHeight;
      if (c.width !== W) c.width = W;
      if (c.height !== H) c.height = H;

      const ctx = c.getContext("2d");
      if (!ctx) return;

      ctx.save();
      ctx.clearRect(0, 0, c.width, c.height);

      const lms = results?.poseLandmarks;
      // eslint-disable-next-line no-console
      console.log("Drawing skeleton, landmarks:", lms?.length);

      if (lms) {
        const draw = window as any;
        const connections = (window as any).POSE_CONNECTIONS ?? POSE_CONNECTIONS;
        if (draw.drawConnectors && connections) {
          draw.drawConnectors(ctx, lms, connections, { color, lineWidth: 3 });
        }
        if (draw.drawLandmarks) {
          draw.drawLandmarks(ctx, lms, { color: "#ffffff", lineWidth: 1, fillColor: color, radius: 3 });
          // Highlight ankles (27, 28)
          const ankles = [lms[27], lms[28]].filter(Boolean);
          draw.drawLandmarks(ctx, ankles, { color: "#ffffff", lineWidth: 2, fillColor: "#ff3b3b", radius: 7 });
        }
      }
      ctx.restore();

      // Debug mirror canvas
      const dbg = debugCanvasRef?.current;
      if (dbg && lms) {
        if (dbg.width !== W) dbg.width = W;
        if (dbg.height !== H) dbg.height = H;
        const dctx = dbg.getContext("2d");
        if (dctx) {
          const dcolor = debugColor ?? "#00e5b4";
          dctx.fillStyle = "#0a0a0a";
          dctx.fillRect(0, 0, W, H);
          const draw = window as any;
          const connections = (window as any).POSE_CONNECTIONS ?? POSE_CONNECTIONS;
          if (draw.drawConnectors && connections) {
            draw.drawConnectors(dctx, lms, connections, { color: dcolor, lineWidth: 3 });
          }
          if (draw.drawLandmarks) {
            draw.drawLandmarks(dctx, lms, { color: "#ffffff", lineWidth: 1, fillColor: dcolor, radius: 3 });
          }
        }
      }

      if (!lms) return;

      // ankle speed sampling
      const left = lms[27] ?? null;
      const right = lms[28] ?? null;
      const t = v.currentTime ?? 0;
      const prev = lastAnklesRef.current;
      const dt = prev ? Math.max(1 / 60, t - prev.t) : 0;
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
      } catch {
        busyRef.current = false;
      }
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
        // swallow
      }
    }
  }, [enabled, formatError, videoSrc, videoId, sport, color, debugColor, videoRef, canvasRef, debugCanvasRef]);

  // Touch MP_CDN to keep import (silences unused warning in some builds)
  void MP_CDN;

  return { ready, formatError, framesProcessed };
}
