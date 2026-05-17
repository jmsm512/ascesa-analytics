import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";

export type HipPoint = { nx: number; ny: number };

const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

export async function createPoseLandmarker(opts: {
  numPoses: number;
  runningMode: "VIDEO" | "IMAGE";
}): Promise<PoseLandmarker> {
  const fileset = await FilesetResolver.forVisionTasks(WASM_URL);
  return PoseLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
    runningMode: opts.runningMode,
    numPoses: opts.numPoses,
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
  const lm = await createPoseLandmarker({ numPoses: maxPeople, runningMode: "IMAGE" });
  try {
    const result = lm.detect(img);
    const people: HipPoint[] = [];
    for (const landmarks of result.landmarks ?? []) {
      if (landmarks?.[23] && landmarks?.[24]) {
        people.push({
          nx: (landmarks[23].x + landmarks[24].x) / 2,
          ny: (landmarks[23].y + landmarks[24].y) / 2,
        });
      }
    }
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
