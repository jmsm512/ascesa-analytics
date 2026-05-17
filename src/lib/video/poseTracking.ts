import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";

export type HipPoint = { nx: number; ny: number };

const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task";

export async function createPoseLandmarker(opts: {
  numPoses: number;
  runningMode: "VIDEO" | "IMAGE";
  minConfidence?: number;
}): Promise<PoseLandmarker> {
  const fileset = await FilesetResolver.forVisionTasks(WASM_URL);
  const minConfidence = opts.minConfidence ?? 0.5;
  return PoseLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
    runningMode: opts.runningMode,
    numPoses: opts.numPoses,
    minPoseDetectionConfidence: minConfidence,
    minPosePresenceConfidence: minConfidence,
    minTrackingConfidence: minConfidence,
  });
}

/** Extract hip midpoints for every detected person on a given image element. */
export async function detectPeopleOnImage(
  imgSrc: string,
  maxPeople = 4,
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

  const lm = await createPoseLandmarker({
    numPoses: maxPeople,
    runningMode: "IMAGE",
    minConfidence: 0.3,
  });
  try {
    const result = lm.detect(img);
    const people: HipPoint[] = hipPointsFromLandmarks(result.landmarks ?? [], 0.3);
    const landmarksList = result.landmarks ?? [];
    console.log("[detectPeopleOnImage] raw poses detected:", landmarksList.length);
    console.log("[detectPeopleOnImage] accepted hip points:", people);
    if (people.length < 2) {
      const zonedPeople = await detectPeopleInHorizontalZones(img, 0.3);
      console.log("[detectPeopleOnImage] fallback zone hip points:", zonedPeople);
      if (zonedPeople.length > people.length) return zonedPeople;
    }
    return people;
  } finally {
    lm.close();
  }
}

function hipPointsFromLandmarks(
  landmarksList: Array<Array<{ x: number; y: number; visibility?: number }>>,
  minVisibility: number,
): HipPoint[] {
  const people: HipPoint[] = [];
  for (const landmarks of landmarksList) {
    const lHip = landmarks?.[23];
    const rHip = landmarks?.[24];
    if (!lHip || !rHip) continue;
    const vis = Math.min(lHip.visibility ?? 1, rHip.visibility ?? 1);
    if (vis < minVisibility) {
      console.log("[detectPeopleOnImage] skipping pose with hip visibility", vis);
      continue;
    }
    people.push({ nx: (lHip.x + rHip.x) / 2, ny: (lHip.y + rHip.y) / 2 });
  }
  return people;
}

async function detectPeopleInHorizontalZones(
  img: HTMLImageElement,
  minConfidence: number,
): Promise<HipPoint[]> {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return [];
  const zoneWidth = Math.floor(img.naturalWidth / 2);
  const zoneHeight = img.naturalHeight;
  canvas.width = zoneWidth;
  canvas.height = zoneHeight;

  const lm = await createPoseLandmarker({ numPoses: 1, runningMode: "IMAGE", minConfidence });
  try {
    const zones: HipPoint[] = [];
    for (const zone of [0, 1]) {
      ctx.clearRect(0, 0, zoneWidth, zoneHeight);
      ctx.drawImage(img, zone * zoneWidth, 0, zoneWidth, zoneHeight, 0, 0, zoneWidth, zoneHeight);
      const result = lm.detect(canvas);
      const [point] = hipPointsFromLandmarks(result.landmarks ?? [], minConfidence);
      if (point) {
        zones.push({ nx: (point.nx + zone) / 2, ny: point.ny });
      }
    }
    return zones;
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
