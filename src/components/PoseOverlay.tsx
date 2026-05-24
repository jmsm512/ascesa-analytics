import { useEffect, useRef } from "react";
import {
  PoseLandmarker,
  FilesetResolver,
  DrawingUtils,
} from "@mediapipe/tasks-vision";

type PoseOverlayProps = {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  targetIndex?: number;
  visible?: boolean;
  onLungeData?: (angle: number) => void;
};

const WASM_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task";

export function PoseOverlay({ videoRef, targetIndex = 0, visible = true, onLungeData }: PoseOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const targetIndexRef = useRef(targetIndex);
  targetIndexRef.current = targetIndex;
  const visibleRef = useRef(visible);
  visibleRef.current = visible;
  const lungeRef = useRef(onLungeData);
  lungeRef.current = onLungeData;

  useEffect(() => {
    let cancelled = false;
    let landmarker: PoseLandmarker | null = null;
    let rafId: number | null = null;
    let running = false;
    let lastTs = -1;

    const loop = () => {
      if (cancelled) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && landmarker && video.readyState >= 2 && !video.paused && !video.ended) {
        const ts = performance.now();
        if (ts !== lastTs) {
          lastTs = ts;
          try {
            const results = landmarker.detectForVideo(video, ts);
            console.log("PoseOverlay onResults landmarks:", results.landmarks.length);
            const ctx = canvas.getContext("2d");
            if (ctx) {
              const width = canvas.clientWidth || video.clientWidth || 1;
              const height = canvas.clientHeight || video.clientHeight || 1;
              if (canvas.width !== width) canvas.width = width;
              if (canvas.height !== height) canvas.height = height;
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              if (!visibleRef.current) return;
              const lm = results.landmarks[targetIndexRef.current];
              if (lm) {
                const drawingUtils = new DrawingUtils(ctx);
                drawingUtils.drawConnectors(lm, PoseLandmarker.POSE_CONNECTIONS, {
                  color: "#00e5b4",
                  lineWidth: 3,
                });
                drawingUtils.drawLandmarks(lm, {
                  color: "#00e5b4",
                  fillColor: "#00e5b4",
                  radius: 3,
                });
              }
            }
          } catch (err) {
            console.warn("PoseOverlay detect failed", err);
          }
        }
      }
      rafId = requestAnimationFrame(loop);
    };

    const start = () => {
      if (running) return;
      running = true;
      if (rafId == null) rafId = requestAnimationFrame(loop);
    };
    const stop = () => {
      running = false;
      if (rafId != null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    };

    let attachedVideo: HTMLVideoElement | null = null;
    const tryAttach = () => {
      const v = videoRef.current;
      if (!v || v === attachedVideo) return;
      if (attachedVideo) {
        attachedVideo.removeEventListener("play", start);
        attachedVideo.removeEventListener("pause", stop);
        attachedVideo.removeEventListener("ended", stop);
      }
      attachedVideo = v;
      v.addEventListener("play", start);
      v.addEventListener("pause", stop);
      v.addEventListener("ended", stop);
      if (!v.paused && !v.ended) start();
    };
    const attachInterval = window.setInterval(tryAttach, 500);
    tryAttach();

    (async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(WASM_URL);
        if (cancelled) return;
        landmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: MODEL_URL,
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numPoses: 2,
          minPoseDetectionConfidence: 0.5,
          minPosePresenceConfidence: 0.5,
        });
        console.log("PoseOverlay initialized");
        const v = videoRef.current;
        if (v && !v.paused && !v.ended) start();
      } catch (err) {
        console.warn("PoseOverlay init failed", err);
      }
    })();

    return () => {
      cancelled = true;
      clearInterval(attachInterval);
      stop();
      if (attachedVideo) {
        attachedVideo.removeEventListener("play", start);
        attachedVideo.removeEventListener("pause", stop);
        attachedVideo.removeEventListener("ended", stop);
      }
      landmarker?.close();
      landmarker = null;
    };
  }, []);

  return (
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
  );
}
