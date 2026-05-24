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
  initialHipPosition?: { x: number; y: number } | null;
};

const WASM_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task";

export function PoseOverlay({ videoRef, targetIndex = 0, visible = true, onLungeData, initialHipPosition = null }: PoseOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const targetIndexRef = useRef(targetIndex);
  targetIndexRef.current = targetIndex;
  const visibleRef = useRef(visible);
  visibleRef.current = visible;
  const lungeRef = useRef(onLungeData);
  lungeRef.current = onLungeData;
  const lastHipPositionRef = useRef<{ x: number; y: number } | null>(null);
  if (initialHipPosition && !lastHipPositionRef.current) lastHipPositionRef.current = initialHipPosition;

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
              let selectedIndex = targetIndexRef.current;
              const hipMidpoints: Array<{ x: number; y: number } | null> = results.landmarks.map((p: any) => {
                if (p && p[23] && p[24]) {
                  return { x: (p[23].x + p[24].x) / 2, y: (p[23].y + p[24].y) / 2 };
                }
                return null;
              });
              if (results.landmarks.length === 1) {
                selectedIndex = 0;
              } else if (results.landmarks.length > 1 && lastHipPositionRef.current) {
                let bestIdx = -1;
                let bestDist = Infinity;
                for (let i = 0; i < hipMidpoints.length; i++) {
                  const hp = hipMidpoints[i];
                  if (!hp) continue;
                  const dx = hp.x - lastHipPositionRef.current.x;
                  const dy = hp.y - lastHipPositionRef.current.y;
                  const d = Math.sqrt(dx * dx + dy * dy);
                  if (d < bestDist) {
                    bestDist = d;
                    bestIdx = i;
                  }
                }
                if (bestIdx !== -1) selectedIndex = bestIdx;
              }
              const lm = results.landmarks[selectedIndex];
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
                const kneeAngle = (a: any, b: any, c: any) => {
                  const v1x = a.x - b.x, v1y = a.y - b.y, v1z = (a.z ?? 0) - (b.z ?? 0);
                  const v2x = c.x - b.x, v2y = c.y - b.y, v2z = (c.z ?? 0) - (b.z ?? 0);
                  const dot = v1x * v2x + v1y * v2y + v1z * v2z;
                  const m1 = Math.sqrt(v1x * v1x + v1y * v1y + v1z * v1z);
                  const m2 = Math.sqrt(v2x * v2x + v2y * v2y + v2z * v2z);
                  if (m1 === 0 || m2 === 0) return 180;
                  const cos = Math.max(-1, Math.min(1, dot / (m1 * m2)));
                  return (Math.acos(cos) * 180) / Math.PI;
                };
                if (lm[23] && lm[25] && lm[27] && lm[24] && lm[26] && lm[28]) {
                  const left = kneeAngle(lm[23], lm[25], lm[27]);
                  const right = kneeAngle(lm[24], lm[26], lm[28]);
                  const front = Math.min(left, right);
                  if (front < 150) lungeRef.current?.(front);
                }
                const selectedHip = hipMidpoints[selectedIndex];
                if (selectedHip) lastHipPositionRef.current = selectedHip;
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
