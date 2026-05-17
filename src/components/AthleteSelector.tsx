import { useEffect, useState } from "react";
import { detectPeopleOnImage, type HipPoint } from "@/lib/video/poseTracking";

type Props = {
  firstFrame: string;
  onBack?: () => void;
  onConfirm: (seedHip: HipPoint | null) => void;
  confirmLabel?: string;
};

/**
 * Shared "Step 3 — Select athlete" UI used by both session video and benchmark
 * clip analysis flows.
 *
 * - Runs MediaPipe Pose Landmarker on the first frame and renders a numbered
 *   dot at every detected person's hip midpoint.
 * - Dots are absolutely-positioned <button>s (same approach as calibration
 *   dots) — no canvas/SVG.
 * - Selecting a dot toggles teal -> violet. Confirm appears only after a
 *   selection (or auto-enables when ≤1 person is detected).
 */
export function AthleteSelector({
  firstFrame,
  onBack,
  onConfirm,
  confirmLabel = "Confirm — Analyze Video",
}: Props) {
  const [detecting, setDetecting] = useState(true);
  const [candidates, setCandidates] = useState<HipPoint[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setDetecting(true);
    setCandidates([]);
    setSelectedIdx(null);
    setError(null);
    (async () => {
      try {
        const people = await detectPeopleOnImage(firstFrame, 6);
        if (cancelled) return;
        console.log("[AthleteSelector] detected people:", people.length, people);
        setCandidates(people);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Pose detection failed");
      } finally {
        if (!cancelled) setDetecting(false);
      }
    })();
    return () => { cancelled = true; };
  }, [firstFrame]);

  const autoMode = !detecting && candidates.length <= 1;
  const canConfirm = !detecting && (autoMode || selectedIdx !== null);

  return (
    <div>
      <div className="metric-label mb-2">Step 3 · Select athlete</div>
      {detecting ? (
        <p className="mb-4 text-xs text-[var(--text-secondary)]">
          Detecting people in the first frame…
        </p>
      ) : candidates.length === 0 ? (
        <p className="mb-4 text-xs text-[var(--text-secondary)]">
          No athletes detected — we'll still analyze using the most prominent person.
        </p>
      ) : candidates.length === 1 ? (
        <p className="mb-4 text-xs text-[var(--text-secondary)]">
          One athlete detected — tracking automatically.
        </p>
      ) : (
        <p className="mb-4 text-xs text-[var(--text-secondary)]">
          Click the dot on the athlete you want to track ({candidates.length} detected).
        </p>
      )}

      {error && (
        <p className="mb-3 text-xs text-[var(--danger,#ef4444)]">{error}</p>
      )}

      <div style={{ position: "relative", display: "inline-block", maxWidth: "100%" }}>
        <img src={firstFrame} alt="First frame" style={{ maxWidth: "100%", display: "block" }} />
        {candidates.map((p, i) => {
          const selected = selectedIdx === i;
          return (
            <button
              key={i}
              type="button"
              onClick={() => setSelectedIdx(i)}
              title={`Athlete ${i + 1}`}
              aria-pressed={selected}
              style={{
                position: "absolute",
                left: `${p.nx * 100}%`,
                top: `${p.ny * 100}%`,
                width: selected ? 32 : 26,
                height: selected ? 32 : 26,
                borderRadius: "50%",
                background: selected ? "var(--fencing)" : "var(--accent)",
                border: selected ? "3px solid white" : "2px solid rgba(255,255,255,0.85)",
                transform: "translate(-50%, -50%)",
                boxShadow: selected
                  ? "0 0 0 3px var(--fencing), 0 0 14px rgba(0,0,0,0.6)"
                  : "0 0 10px rgba(0,0,0,0.5)",
                cursor: "pointer",
                padding: 0,
                color: "white",
                fontSize: 13,
                fontWeight: 700,
                lineHeight: 1,
                display: "grid",
                placeItems: "center",
                zIndex: 10,
              }}
            >
              {i + 1}
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex gap-3">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-default)] px-3 py-1.5 text-xs hover:bg-[var(--bg-elevated)]"
          >
            Back
          </button>
        )}
        {canConfirm && (
          <button
            type="button"
            onClick={() =>
              onConfirm(
                selectedIdx !== null
                  ? candidates[selectedIdx]
                  : candidates[0] ?? null,
              )
            }
            className="rounded-md bg-[var(--accent)] px-4 py-1.5 text-xs font-semibold text-black hover:opacity-90"
          >
            {confirmLabel}
          </button>
        )}
      </div>
    </div>
  );
}
