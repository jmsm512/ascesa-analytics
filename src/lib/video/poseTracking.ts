import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";

export type HipPoint = { nx: number; ny: number };

const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task";

export async function createPoseLandmarker(opts: {
  numPoses: number;
  runningMode: "VIDEO" | "IMAGE";
}): Promise<PoseLandmarker> {
  const fileset = await FilesetResolver.forVisionTasks(WASM_URL);
  return PoseLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
    runningMode: opts.runningMode,
    numPoses: opts.numPoses,
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });
}

/** Extract hip midpoints for every detected person on a given image element. */
export async function detectPeopleOnImage(
  imgSrc: string,
  maxPeople = 6,
): Promise<HipPoint[]> {
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.crossOrigin = "anonymous";
    i.onload = () => res(i);
    i.onerror = () => rej(new Error("Failed to load first-frame image"));
    i.src = imgSrc;
  });
  try {
    // Ensure image is fully decoded before passing to MediaPipe
    if (typeof (img as any).decode === "function") {
      try { await (img as any).decode(); } catch { /* ignore */ }
    }
  } catch { /* ignore */ }

  const lm = await createPoseLandmarker({ numPoses: maxPeople, runningMode: "IMAGE" });
  try {
    const result = lm.detect(img);
    const people: HipPoint[] = [];
    const landmarksList = result.landmarks ?? [];
    console.log("[detectPeopleOnImage] raw poses detected:", landmarksList.length);
    for (const landmarks of landmarksList) {
      const lHip = landmarks?.[23];
      const rHip = landmarks?.[24];
      if (!lHip || !rHip) continue;
      // Filter on landmark visibility/presence to drop low-confidence noise
      const vis = Math.min(
        (lHip as any).visibility ?? 1,
        (rHip as any).visibility ?? 1,
      );
      if (vis < 0.5) {
        console.log("[detectPeopleOnImage] skipping pose with hip visibility", vis);
        continue;
      }
      people.push({
        nx: (lHip.x + rHip.x) / 2,
        ny: (lHip.y + rHip.y) / 2,
      });
    }
    console.log("[detectPeopleOnImage] accepted hip points:", people);
    return people;
  } finally {
    lm.close();
  }
}

/** From a multi-pose detection result, pick the hip midpoint nearest to `last`. */
export function pickClosestHip(
  landmarksList: Array<Array<{ x: number; y: number }>> | undefined,
  last: HipPoint | null,
): HipPoint | null {
  if (!landmarksList || landmarksList.length === 0) return null;
  let best: HipPoint | null = null;
  let bestDist = Infinity;
  for (const lm of landmarksList) {
    if (!lm?.[23] || !lm?.[24]) continue;
    const hp: HipPoint = {
      nx: (lm[23].x + lm[24].x) / 2,
      ny: (lm[23].y + lm[24].y) / 2,
    };
    if (!last) return hp; // first frame with no prior: take first valid
    const d = Math.hypot(hp.nx - last.nx, hp.ny - last.ny);
    if (d < bestDist) {
      bestDist = d;
      best = hp;
    }
  }
  return best;
}
