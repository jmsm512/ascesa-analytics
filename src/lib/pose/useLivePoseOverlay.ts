// Real-time MediaPipe Pose overlay on a playing <video>.
// Uses the SAME MediaPipe instance as detectPeopleOnImage (@mediapipe/tasks-vision
// PoseLandmarker) — running in VIDEO mode — and draws inside that detection
// callback with DrawingUtils from the same package.

import { useEffect, useRef, useState } from "react";
import { DrawingUtils, PoseLandmarker, type PoseLandmarkerResult } from "@mediapipe/tasks-vision";
import { supabase } from "@/integrations/supabase/client";
import { createPoseLandmarker } from "@/lib/video/poseTracking";
import type { Landmark } from "./runPoseAnalysis";

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

export function useLivePoseOverlay(opts: LiveOverlayOpts): LiveOverlayState {
  const { videoRef, canvasRef, debugCanvasRef, videoSrc, videoId, sport, color, debugColor, enabled } = opts;
  const [ready, setReady] = useState(false);
  const [formatError, setFormatError] = useState<string | null>(null);
  const [framesProcessed, setFramesProcessed] = useState(0);

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
    let landmarker: PoseLandmarker | null = null;
    let rafId: number | null = null;
    let vfcId: number | null = null;
    let lastVideoTimeMs = -1;
    const supportsVFC = typeof (video as any).requestVideoFrameCallback === "function";

    async function init() {
      try {
        landmarker = await createPoseLandmarker({
          numPoses: 2,
          runningMode: "VIDEO",
          minConfidence: 0.5,
        });
        if (cancelled) { landmarker?.close(); return; }
        setReady(true);
        schedule();
      } catch (e: any) {
        setFormatError(e?.message ?? "Failed to initialize MediaPipe Pose");
      }
    }

    function handleResults(results: PoseLandmarkerResult, tSec: number) {
      const c = canvasRef.current;
      const v = videoRef.current;
      if (!c || !v) return;

      const W = v.videoWidth || c.clientWidth;
      const H = v.videoHeight || c.clientHeight;
      if (c.width !== W) c.width = W;
      if (c.height !== H) c.height = H;

      const ctx = c.getContext("2d");
      if (!ctx) return;

      ctx.clearRect(0, 0, c.width, c.height);

      const allLms = results?.landmarks ?? [];
      // eslint-disable-next-line no-console
      console.log("Drawing skeleton, landmarks:", allLms[0]?.length);

      if (allLms.length) {
        const utils = new DrawingUtils(ctx);
        for (const lms of allLms) {
          utils.drawConnectors(lms, PoseLandmarker.POSE_CONNECTIONS, { color, lineWidth: 3 });
          utils.drawLandmarks(lms, { color: "#ffffff", fillColor: color, radius: 3, lineWidth: 1 });
          const ankles = [lms[27], lms[28]].filter(Boolean);
          if (ankles.length) {
            utils.drawLandmarks(ankles as any, { color: "#ffffff", fillColor: "#ff3b3b", radius: 7, lineWidth: 2 });
          }
        }
      }

      // Debug mirror canvas
      const dbg = debugCanvasRef?.current;
      if (dbg && allLms.length) {
        if (dbg.width !== W) dbg.width = W;
        if (dbg.height !== H) dbg.height = H;
        const dctx = dbg.getContext("2d");
        if (dctx) {
          const dcolor = debugColor ?? "#00e5b4";
          dctx.fillStyle = "#0a0a0a";
          dctx.fillRect(0, 0, W, H);
          const dutils = new DrawingUtils(dctx);
          for (const lms of allLms) {
            dutils.drawConnectors(lms, PoseLandmarker.POSE_CONNECTIONS, { color: dcolor, lineWidth: 3 });
            dutils.drawLandmarks(lms, { color: "#ffffff", fillColor: dcolor, radius: 3, lineWidth: 1 });
          }
        }
      }

      const primary = allLms[0];
      if (!primary) return;

      const left = primary[27] ?? null;
      const right = primary[28] ?? null;
      const prev = lastAnklesRef.current;
      const dt = prev ? Math.max(1 / 60, tSec - prev.t) : 0;
      const nose = primary[0];
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
      lastAnklesRef.current = { t: tSec, left: left as any, right: right as any };
      sampleBufferRef.current.push({ t: tSec, leftSpeed, rightSpeed, left: left as any, right: right as any });
      setFramesProcessed((n) => n + 1);
      scheduleFlush();
    }

    function process() {
      if (cancelled || !landmarker) return;
      const v = videoRef.current;
      if (!v || v.paused || v.ended) { schedule(); return; }
      frameCounterRef.current += 1;
      if (frameCounterRef.current % 3 !== 0) { schedule(); return; }

      const tSec = v.currentTime ?? 0;
      const tMs = performance.now();
      if (v.currentTime * 1000 === lastVideoTimeMs) { schedule(); return; }
      lastVideoTimeMs = v.currentTime * 1000;

      try {
        const results = landmarker.detectForVideo(v, tMs);
        handleResults(results, tSec);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn("detectForVideo failed", err);
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
      landmarker?.close();
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

  return { ready, formatError, framesProcessed };
}
