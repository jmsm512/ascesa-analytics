import { useEffect, useRef, useState } from "react";
import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";

const WASM_BASE = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task";

type Box = { x: number; y: number; w: number; h: number };

type Props = {
  frameDataUrl: string;
  onSelect: (athleteIndex: number) => void;
  onCancel?: () => void;
};

export function AthleteSelector({ frameDataUrl, onSelect, onCancel }: Props) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [boxes, setBoxes] = useState<Box[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function detect() {
      setLoading(true);
      setError(null);
      try {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = frameDataUrl;
        await new Promise<void>((res, rej) => {
          img.onload = () => res();
          img.onerror = () => rej(new Error("Failed to load frame"));
        });

        const fileset = await FilesetResolver.forVisionTasks(WASM_BASE);
        const landmarker = await PoseLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
          runningMode: "IMAGE",
          numPoses: 8,
          minPoseDetectionConfidence: 0.25,
          minPosePresenceConfidence: 0.25,
        });

        const result = landmarker.detect(img);
        landmarker.close();
        if (cancelled) return;

        const detected: Box[] = (result.landmarks ?? []).map((lms) => {
          const xs = lms.map((l) => l.x);
          const ys = lms.map((l) => l.y);
          const minX = Math.max(0, Math.min(...xs) - 0.04);
          const maxX = Math.min(1, Math.max(...xs) + 0.04);
          const minY = Math.max(0, Math.min(...ys) - 0.04);
          const maxY = Math.min(1, Math.max(...ys) + 0.04);
          return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
        });
        setBoxes(detected);
        // Do NOT auto-advance — wait for explicit user click.
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Detection failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    detect();
    return () => {
      cancelled = true;
    };
  }, [frameDataUrl]);

  return (
    <div className="surface p-5">
      <div className="metric-label mb-2">Select the tracked athlete</div>
      <p className="mb-4 text-xs text-[var(--text-secondary)]">
        {loading
          ? "Detecting fencers in the frame…"
          : boxes && boxes.length >= 1
            ? "Click the fencer you want to track."
            : "No fencers detected. Try a different starting frame."}
      </p>

      {error && (
        <div className="mb-3 rounded-md border border-[var(--data-negative)]/40 bg-[var(--data-negative)]/10 p-3 text-sm text-[var(--data-negative)]">
          {error}
        </div>
      )}

      <div style={{ position: "relative", display: "inline-block", maxWidth: "100%" }}>
        <img
          ref={imgRef}
          src={frameDataUrl}
          alt="First frame"
          style={{ maxWidth: "100%", display: "block" }}
        />
        {boxes?.map((b, i) => (
          <button
            key={i}
            onClick={() => onSelect(i)}
            style={{
              position: "absolute",
              left: `${b.x * 100}%`,
              top: `${b.y * 100}%`,
              width: `${b.w * 100}%`,
              height: `${b.h * 100}%`,
              border: "3px solid var(--accent)",
              background: "rgba(0, 229, 180, 0.12)",
              cursor: "pointer",
              boxShadow: "0 0 0 2px rgba(0,0,0,0.4)",
            }}
            title={`Select athlete ${i + 1}`}
          >
            <span
              style={{
                position: "absolute",
                top: -12,
                left: -12,
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: "var(--accent)",
                color: "#000",
                fontWeight: 700,
                fontSize: 14,
                display: "grid",
                placeItems: "center",
                boxShadow: "0 2px 6px rgba(0,0,0,0.5)",
              }}
            >
              {i + 1}
            </span>
          </button>
        ))}
      </div>

      {onCancel && (
        <div className="mt-4">
          <button
            onClick={onCancel}
            className="rounded-md border border-[var(--border-default)] px-3 py-1.5 text-xs hover:bg-[var(--bg-elevated)]"
          >
            Back
          </button>
        </div>
      )}
    </div>
  );
}
