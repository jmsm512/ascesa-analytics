// Browser-side MediaPipe Pose analysis.
// Loads MediaPipe Pose from CDN, walks a <video> element frame-by-frame,
// draws the skeleton onto a <canvas>, and emits per-frame ankle speeds (m/s).

const MP_VERSION = "0.5.1675469404";
const MP_CDN = `https://cdn.jsdelivr.net/npm/@mediapipe/pose@${MP_VERSION}`;

type Landmark = { x: number; y: number; z: number; visibility?: number };

export type FrameSample = {
  t: number; // seconds
  leftAnkle: Landmark | null;
  rightAnkle: Landmark | null;
  nose: Landmark | null;
  landmarks: Landmark[] | null;
};

export type SpeedSample = {
  t: number;
  leftSpeed: number; // m/s
  rightSpeed: number; // m/s
};

// MediaPipe POSE_CONNECTIONS subset for skeleton rendering
const CONNECTIONS: [number, number][] = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 24],
  [23, 25], [25, 27], [27, 29], [29, 31], [27, 31],
  [24, 26], [26, 28], [28, 30], [30, 32], [28, 32],
  [0, 11], [0, 12],
];

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement("script");
    s.src = src;
    s.crossOrigin = "anonymous";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}

let poseModulePromise: Promise<any> | null = null;
async function loadPose() {
  if (!poseModulePromise) {
    poseModulePromise = (async () => {
      await loadScript(`${MP_CDN}/pose.js`);
      const Pose = (window as any).Pose;
      if (!Pose) throw new Error("MediaPipe Pose failed to load");
      const pose = new Pose({ locateFile: (f: string) => `${MP_CDN}/${f}` });
      pose.setOptions({
        modelComplexity: 1,
        smoothLandmarks: true,
        enableSegmentation: false,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
      await pose.initialize?.();
      return pose;
    })();
  }
  return poseModulePromise;
}

function seekTo(video: HTMLVideoElement, t: number): Promise<void> {
  return new Promise((resolve) => {
    const onSeeked = () => {
      video.removeEventListener("seeked", onSeeked);
      resolve();
    };
    video.addEventListener("seeked", onSeeked);
    video.currentTime = Math.min(t, video.duration - 0.001);
  });
}

export type AnalyzeOptions = {
  video: HTMLVideoElement;
  canvas: HTMLCanvasElement;
  color: string;
  fps?: number; // sampling rate (default 6)
  athleteHeightM?: number; // for pixel→meter scale fallback (default 1.75)
  onProgress?: (pct: number) => void;
};

export async function runPoseAnalysis(opts: AnalyzeOptions): Promise<SpeedSample[]> {
  const { video, canvas, color, onProgress } = opts;
  const fps = opts.fps ?? 6;
  const athleteHeightM = opts.athleteHeightM ?? 1.75;

  const pose = await loadPose();

  // Ensure metadata is loaded
  if (!video.duration || Number.isNaN(video.duration)) {
    await new Promise<void>((r) => {
      const h = () => { video.removeEventListener("loadedmetadata", h); r(); };
      video.addEventListener("loadedmetadata", h);
    });
  }
  video.pause();

  const W = video.videoWidth;
  const H = video.videoHeight;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  const duration = video.duration;
  const totalFrames = Math.max(1, Math.floor(duration * fps));
  const dt = 1 / fps;

  const samples: FrameSample[] = [];
  let latestResults: any = null;
  pose.onResults((results: any) => {
    latestResults = results;
  });

  for (let i = 0; i < totalFrames; i++) {
    const t = i * dt;
    await seekTo(video, t);
    latestResults = null;
    await pose.send({ image: video });
    // give microtask a chance for onResults
    await new Promise((r) => setTimeout(r, 0));

    const lms: Landmark[] | undefined = latestResults?.poseLandmarks;
    const leftAnkle = lms?.[27] ?? null;
    const rightAnkle = lms?.[28] ?? null;
    const nose = lms?.[0] ?? null;
    samples.push({ t, leftAnkle, rightAnkle, nose, landmarks: lms ?? null });

    // Draw overlay
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(video, 0, 0, W, H);
    if (lms) drawSkeleton(ctx, lms, W, H, color);

    onProgress?.((i + 1) / totalFrames);
  }

  return computeSpeeds(samples, athleteHeightM);
}

function drawSkeleton(
  ctx: CanvasRenderingContext2D,
  lms: Landmark[],
  W: number,
  H: number,
  color: string,
) {
  ctx.lineWidth = 3;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  for (const [a, b] of CONNECTIONS) {
    const pa = lms[a]; const pb = lms[b];
    if (!pa || !pb) continue;
    if ((pa.visibility ?? 1) < 0.4 || (pb.visibility ?? 1) < 0.4) continue;
    ctx.beginPath();
    ctx.moveTo(pa.x * W, pa.y * H);
    ctx.lineTo(pb.x * W, pb.y * H);
    ctx.stroke();
  }
  for (const p of lms) {
    if ((p.visibility ?? 1) < 0.4) continue;
    ctx.beginPath();
    ctx.arc(p.x * W, p.y * H, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function computeSpeeds(samples: FrameSample[], heightM: number): SpeedSample[] {
  // Estimate pixels-per-meter per frame using nose→ankle distance ≈ athlete height
  // Fallback to a running average when not measurable.
  const out: SpeedSample[] = [];
  let lastScale = 0;

  const scaleFor = (s: FrameSample): number => {
    if (s.nose && (s.leftAnkle || s.rightAnkle)) {
      const ankleY = s.leftAnkle && s.rightAnkle
        ? (s.leftAnkle.y + s.rightAnkle.y) / 2
        : (s.leftAnkle ?? s.rightAnkle)!.y;
      const span = Math.abs(ankleY - s.nose.y); // normalized 0..1
      if (span > 0.1) {
        const scale = heightM / span; // meters per normalized unit
        lastScale = scale;
        return scale;
      }
    }
    return lastScale || heightM / 0.7; // sensible default
  };

  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    const prev = samples[i - 1];
    const scale = scaleFor(s);
    let leftSpeed = 0;
    let rightSpeed = 0;
    if (prev) {
      const dt = s.t - prev.t || 1 / 30;
      if (s.leftAnkle && prev.leftAnkle) {
        const dx = (s.leftAnkle.x - prev.leftAnkle.x) * scale;
        const dy = (s.leftAnkle.y - prev.leftAnkle.y) * scale;
        leftSpeed = Math.hypot(dx, dy) / dt;
      }
      if (s.rightAnkle && prev.rightAnkle) {
        const dx = (s.rightAnkle.x - prev.rightAnkle.x) * scale;
        const dy = (s.rightAnkle.y - prev.rightAnkle.y) * scale;
        rightSpeed = Math.hypot(dx, dy) / dt;
      }
    }
    out.push({ t: s.t, leftSpeed, rightSpeed });
  }
  return out;
}
