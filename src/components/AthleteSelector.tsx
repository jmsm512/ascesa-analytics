import { useEffect, useRef, useState } from "react";
import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";

const WASM_BASE = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task";

type Box = { x: number; y: number; w: number; h: number };

type Props = {
  frameDataUrl: string;
  onSelect: (athleteIndex: number, center: { x: number; y: number }) => void;
  onCancel?: () => void;
};

export function AthleteSelector({ frameDataUrl, onSelect, onCancel }: Props) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [boxes, setBoxes] = useState<Box[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [manualBoxes, setManualBoxes] = useState<Box[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function detect() {
      setLoading(true);
      setError(null);
      setManualBoxes([]);
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
          minPoseDetectionConfidence: 0.15,
          minPosePresenceConfidence: 0.15,
        });

        const result = landmarker.detect(img);
        landmarker.close();
        if (cancelled) return;

        const detectedRaw = (result.landmarks ?? []).map((lms) => {
          const xs = lms.map((l) => l.x);
          const ys = lms.map((l) => l.y);
          const minX = Math.max(0, Math.min(...xs) - 0.04);
          const maxX = Math.min(1, Math.max(...xs) + 0.04);
          const minY = Math.max(0, Math.min(...ys) - 0.04);
          const maxY = Math.min(1, Math.max(...ys) + 0.04);
          const visScores = lms.map((l: any) => (typeof l.visibility === "number" ? l.visibility : 0));
          const avgVis = visScores.length ? visScores.reduce((a, b) => a + b, 0) / visScores.length : 0;
          const box: Box = { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
          return { box, avgVis, cx: minX + (maxX - minX) / 2, cy: minY + (maxY - minY) / 2 };
        });

        // Deduplicate: if two detections' centers are within 10% of frame
        // width/height of each other, keep only the one with the highest
        // average landmark visibility.
        const sorted = [...detectedRaw].sort((a, b) => b.avgVis - a.avgVis);
        const kept: typeof sorted = [];
        for (const cand of sorted) {
          const dup = kept.some(
            (k) => Math.abs(k.cx - cand.cx) < 0.1 && Math.abs(k.cy - cand.cy) < 0.1,
          );
          if (!dup) kept.push(cand);
        }
        const detected: Box[] = kept.map((k) => k.box);
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
          onClick={(e) => {
            if (!imgRef.current) return;
            const rect = imgRef.current.getBoundingClientRect();
            const x = (e.clientX - rect.left) / rect.width;
            const y = (e.clientY - rect.top) / rect.height;
            const newBox: Box = {
              x: Math.max(0, Math.min(1 - 0.15, x - 0.075)),
              y: Math.max(0, Math.min(1 - 0.4, y - 0.2)),
              w: 0.15,
              h: 0.4,
            };
            setManualBoxes((prev) => [...prev, newBox]);
          }}
        />
        {[...(boxes ?? []), ...manualBoxes].map((b, i) => (
          <button
            key={i}
            onClick={(e) => { e.stopPropagation(); onSelect(i); }}
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
            <span
              style={{
                position: "absolute",
                bottom: 4,
                left: "50%",
                transform: "translateX(-50%)",
                background: "var(--accent)",
                color: "#000",
                fontWeight: 700,
                fontSize: 11,
                padding: "2px 8px",
                borderRadius: 4,
                whiteSpace: "nowrap",
              }}
            >
              Select
            </span>
          </button>
        ))}
      </div>

      {!loading && (
        <p className="mt-3 text-xs text-[var(--text-secondary)]">
          Don't see the right athlete? Click directly on them in the image.
        </p>
      )}

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
