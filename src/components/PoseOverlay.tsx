import { useEffect, useRef } from "react";

const POSE_CDN = "https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404";
const DRAWING_UTILS_CDN = "https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils@0.3.1675466124";

type PoseOverlayProps = {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  targetIndex?: number;
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

export function PoseOverlay({ videoRef, targetIndex = 0 }: PoseOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const poseRef = useRef<any>(null);
  const rafRef = useRef<number | null>(null);
  const sendingRef = useRef(false);
  const runningRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const loop = async () => {
      if (cancelled || !runningRef.current) return;
      const video = videoRef.current;
      const pose = poseRef.current;
      if (video && pose && video.readyState >= 2 && !video.paused && !video.ended) {
        if (!sendingRef.current) {
          sendingRef.current = true;
          try {
            await pose.send({ image: video });
          } catch (err) {
            console.warn("PoseOverlay send failed", err);
          } finally {
            sendingRef.current = false;
          }
        }
      }
      rafRef.current = requestAnimationFrame(loop);
    };

    const startLoop = () => {
      if (runningRef.current) return;
      runningRef.current = true;
      if (rafRef.current == null) rafRef.current = requestAnimationFrame(loop);
    };
    const stopLoop = () => {
      runningRef.current = false;
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };

    // Attach play/pause listeners to whatever video element exists now and
    // keep retrying until one shows up (parent mounts <video> conditionally).
    let attachedVideo: HTMLVideoElement | null = null;
    const tryAttach = () => {
      const v = videoRef.current;
      if (!v || v === attachedVideo) return;
      if (attachedVideo) {
        attachedVideo.removeEventListener("play", startLoop);
        attachedVideo.removeEventListener("pause", stopLoop);
        attachedVideo.removeEventListener("ended", stopLoop);
      }
      attachedVideo = v;
      v.addEventListener("play", startLoop);
      v.addEventListener("pause", stopLoop);
      v.addEventListener("ended", stopLoop);
      if (!v.paused && !v.ended) startLoop();
    };
    const attachInterval = window.setInterval(tryAttach, 500);
    tryAttach();

    (async () => {
      try {
        await loadScript(`${DRAWING_UTILS_CDN}/drawing_utils.js`);
        await loadScript(`${POSE_CDN}/pose.js`);
        if (cancelled) return;
        const Pose = (window as any).Pose;
        if (!Pose) throw new Error("MediaPipe Pose failed to load");

        const pose = new Pose({ locateFile: (file: string) => `${POSE_CDN}/${file}` });
        console.log("PoseOverlay initialized");
        pose.setOptions({
          modelComplexity: 1,
          smoothLandmarks: true,
          enableSegmentation: false,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });

        pose.onResults((results: PoseResults) => {
          console.log("PoseOverlay onResults, landmarks:", results.poseLandmarks?.length);
          const canvas = canvasRef.current;
          const video = videoRef.current;
          if (!canvas || !video) return;
          const ctx = canvas.getContext("2d");
          if (!ctx) return;

          const width = canvas.clientWidth || video.clientWidth || 1;
          const height = canvas.clientHeight || video.clientHeight || 1;
          if (canvas.width !== width) canvas.width = width;
          if (canvas.height !== height) canvas.height = height;

          ctx.clearRect(0, 0, canvas.width, canvas.height);
          if (results.poseLandmarks?.length) {
            (window as any).drawConnectors(
              ctx,
              results.poseLandmarks,
              (window as any).POSE_CONNECTIONS,
              { color: "#00e5b4", lineWidth: 3 },
            );
            (window as any).drawLandmarks(ctx, results.poseLandmarks, {
              color: "#00e5b4",
              fillColor: "#00e5b4",
              radius: 3,
            });
          }
        });

        await pose.initialize?.();
        if (cancelled) return;
        poseRef.current = pose;
        // If the video is already playing by the time pose is ready, kick off the loop.
        const v = videoRef.current;
        if (v && !v.paused && !v.ended) startLoop();
      } catch (err) {
        console.warn("PoseOverlay init failed", err);
      }
    })();

    return () => {
      cancelled = true;
      clearInterval(attachInterval);
      stopLoop();
      if (attachedVideo) {
        attachedVideo.removeEventListener("play", startLoop);
        attachedVideo.removeEventListener("pause", stopLoop);
        attachedVideo.removeEventListener("ended", stopLoop);
      }
      const pose = poseRef.current;
      poseRef.current = null;
      pose?.close?.();
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
