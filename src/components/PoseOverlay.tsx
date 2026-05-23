import { useEffect, useRef } from "react";

const POSE_CDN = "https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404";
const DRAWING_UTILS_CDN = "https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils@0.3.1675466124";

type PoseOverlayProps = {
  videoRef: React.RefObject<HTMLVideoElement | null>;
};

type PoseResults = {
  poseLandmarks?: Array<{ x: number; y: number; z?: number; visibility?: number }>;
};

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.crossOrigin = "anonymous";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

export function PoseOverlay({ videoRef }: PoseOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;
    let rafId: number | null = null;
    let sending = false;
    let pose: any = null;

    async function init() {
      await loadScript(`${DRAWING_UTILS_CDN}/drawing_utils.js`);
      await loadScript(`${POSE_CDN}/pose.js`);
      if (cancelled) return;

      const Pose = (window as any).Pose;
      if (!Pose) throw new Error("MediaPipe Pose failed to load");

      pose = new Pose({ locateFile: (file: string) => `${POSE_CDN}/${file}` });
      pose.setOptions({
        modelComplexity: 1,
        smoothLandmarks: true,
        enableSegmentation: false,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      pose.onResults((results: PoseResults) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const width = canvas.clientWidth || videoRef.current?.clientWidth || 1;
        const height = canvas.clientHeight || videoRef.current?.clientHeight || 1;
        if (canvas.width !== width) canvas.width = width;
        if (canvas.height !== height) canvas.height = height;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        console.log("PoseOverlay drawing", results.poseLandmarks?.length);

        if (results.poseLandmarks?.length) {
          (window as any).drawConnectors(ctx, results.poseLandmarks, (window as any).POSE_CONNECTIONS, {
            color: "#00e5b4",
            lineWidth: 3,
          });
          (window as any).drawLandmarks(ctx, results.poseLandmarks, {
            color: "#00e5b4",
            fillColor: "#00e5b4",
            radius: 3,
          });
        }
      });

      await pose.initialize?.();
      if (!cancelled && videoRef.current && !videoRef.current.paused && !videoRef.current.ended) {
        loop();
      }
    }

    async function loop() {
      const video = videoRef.current;
      if (cancelled || !pose || !video || video.paused || video.ended) return;

      if (!sending) {
        sending = true;
        try {
          await pose.send({ image: video });
        } catch (error) {
          console.warn("PoseOverlay send failed", error);
        } finally {
          sending = false;
        }
      }

      rafId = requestAnimationFrame(loop);
    }

    const video = videoRef.current;
    const start = () => {
      if (rafId == null) rafId = requestAnimationFrame(loop);
    };
    const stop = () => {
      if (rafId != null) cancelAnimationFrame(rafId);
      rafId = null;
    };

    init().catch((error) => console.warn("PoseOverlay init failed", error));
    video?.addEventListener("play", start);
    video?.addEventListener("pause", stop);
    video?.addEventListener("ended", stop);

    return () => {
      cancelled = true;
      stop();
      video?.removeEventListener("play", start);
      video?.removeEventListener("pause", stop);
      video?.removeEventListener("ended", stop);
      pose?.close?.();
    };
  }, [videoRef]);

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