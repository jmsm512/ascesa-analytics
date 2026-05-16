import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell } from "@/components/AppShell";
import { getFencingSession } from "@/lib/data";
import { format } from "date-fns";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { ArrowLeft, Check, X, Upload, RotateCcw, Download } from "lucide-react";
import { msToFps } from "@/lib/units";
import { useServerFn } from "@tanstack/react-start";
import { analyzeFrameFn } from "@/lib/analyzeFrame.functions";

export const Route = createFileRoute("/sessions/fencing/$id")({
  component: FencingSession,
});

const TABS = ["Overview", "Actions", "Video"] as const;

function FencingSession() {
  const { id } = Route.useParams();
  const [tab, setTab] = useState<(typeof TABS)[number]>("Overview");
  const q = useQuery({ queryKey: ["fencing-session", id], queryFn: () => getFencingSession(id) });
  const session = q.data?.session;
  const fs = q.data?.fs;
  const actions = q.data?.actions ?? [];
  const sensors = q.data?.sensors ?? [];

  return (
    <RequireAuth>
      <AppShell>
        <Link to="/" className="inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </Link>

        {session && fs && (
          <div className="surface mt-4 p-6" style={{ borderLeft: "4px solid var(--fencing)" }}>
            <div className="metric-label mb-2">Fencing Bout</div>
            <h1 className="text-2xl font-bold tracking-tight">{format(new Date(session.session_date), "EEEE, MMM d")}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-[var(--text-secondary)]">
              <span>Weapon: <span className="text-[var(--text-primary)]">{fs.weapon}</span></span>
              <span>Opponent: <span className="text-[var(--text-primary)]">{fs.opponent}</span></span>
              <span>Score:{" "}
                <span className={`font-semibold ${fs.result === "win" ? "text-[var(--data-positive)]" : "text-[var(--data-negative)]"}`}>
                  {fs.result?.toUpperCase()} {fs.touches_scored}-{fs.touches_received}
                </span>
              </span>
            </div>
          </div>
        )}

        <div className="mt-6 flex gap-1 border-b border-[var(--border-subtle)]">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`relative px-4 py-2.5 text-sm font-medium transition-colors ${
                tab === t ? "text-[var(--accent)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              {t}
              {tab === t && <span className="absolute inset-x-3 -bottom-px h-0.5 bg-[var(--accent)]" />}
            </button>
          ))}
        </div>

        {tab === "Overview" && fs && (
          <>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <StatCard label="Touches scored" value={String(fs.touches_scored)} accent="positive" />
              <StatCard label="Touches received" value={String(fs.touches_received)} accent="negative" />
              <StatCard label="Result" value={fs.result?.toUpperCase() ?? "—"} accent={fs.result === "win" ? "positive" : "negative"} />
            </div>

            {sensors.length > 0 && (
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <SensorChart title="Attack speed (ft/s)" data={sensors.map((s: any) => ({ ...s, attack_speed_fps: msToFps(Number(s.attack_speed_ms)) }))} dataKey="attack_speed_fps" />
                <SensorChart title="Footwork cadence" data={sensors} dataKey="footwork_cadence" />
              </div>
            )}
          </>
        )}

        {tab === "Actions" && (
          <div className="mt-6 surface overflow-hidden">
            {actions.length === 0 && <div className="px-5 py-10 text-center text-sm text-[var(--text-secondary)]">No actions logged.</div>}
            <ul className="divide-y divide-[var(--border-subtle)]">
              {actions.map((a: any) => (
                <li key={a.id} className="row-hover flex items-center gap-4 px-5 py-3">
                  <div className="w-12 text-xs text-[var(--text-secondary)] tabular-nums">
                    {Math.floor(a.timestamp_seconds / 60)}:{String(Math.floor(a.timestamp_seconds % 60)).padStart(2, "0")}
                  </div>
                  <span className="rounded-full bg-[var(--bg-elevated)] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                    {a.action_type}
                  </span>
                  {a.successful ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--accent-glow)] px-2 py-0.5 text-[10px] font-medium text-[var(--accent)]">
                      <Check className="h-3 w-3" /> Success
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--data-negative)]/15 px-2 py-0.5 text-[10px] font-medium text-[var(--data-negative)]">
                      <X className="h-3 w-3" /> Missed
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {tab === "Video" && <VideoSpeedAnalyzer />}
      </AppShell>
    </RequireAuth>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: "positive" | "negative" }) {
  const color = accent === "positive" ? "var(--data-positive)" : accent === "negative" ? "var(--data-negative)" : undefined;
  return (
    <div className="surface p-5" style={color ? { borderTop: `2px solid ${color}` } : undefined}>
      <div className="metric-label">{label}</div>
      <div className="metric-num-md mt-2" style={color ? { color } : undefined}>{value}</div>
    </div>
  );
}

function SensorChart({ title, data, dataKey }: { title: string; data: any[]; dataKey: string }) {
  return (
    <div className="surface p-5">
      <div className="metric-label mb-3">{title}</div>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data.map((d) => ({ ...d, rep: `R${d.rep_number}` }))}>
            <CartesianGrid stroke="var(--border-subtle)" vertical={false} />
            <XAxis dataKey="rep" tick={{ fill: "var(--text-secondary)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "var(--text-secondary)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)", borderRadius: 8, fontSize: 12 }} />
            <Line type="monotone" dataKey={dataKey} stroke="var(--fencing)" strokeWidth={2.5} dot={{ r: 4, fill: "var(--fencing)" }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ============= Video Speed Analyzer =============

type Pt = { x: number; y: number };
type Frame = { time: number; nx: number; ny: number; detected: boolean };
type Reading = { time: number; speed: number; direction: "advance" | "retreat" };

const MP_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0";

function VideoSpeedAnalyzer() {
  const [stage, setStage] = useState<"upload" | "extracting" | "calibrate" | "analyzing" | "results">("upload");
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [firstFrame, setFirstFrame] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [points, setPoints] = useState<Pt[]>([]);
  const [progress, setProgress] = useState({ cur: 0, total: 0 });
  const [readings, setReadings] = useState<Reading[]>([]);
  const [error, setError] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  function onFile(file: File) {
    setError(null);
    setStage("extracting");
    const reader = new FileReader();
    reader.onload = async () => {
      const url = reader.result as string;
      setDataUrl(url);
      try {
        const { frame, dur } = await extractFirstFrame(url);
        setFirstFrame(frame);
        setDuration(dur);
        setStage("calibrate");
      } catch (e: any) {
        setError(e?.message ?? "Failed to extract frame");
        setStage("upload");
      }
    };
    reader.onerror = () => {
      setError("Failed to read file");
      setStage("upload");
    };
    reader.readAsDataURL(file);
  }

  function extractFirstFrame(url: string): Promise<{ frame: string; dur: number }> {
    return new Promise((resolve, reject) => {
      const v = document.createElement("video");
      v.preload = "auto";
      v.muted = true;
      v.playsInline = true;
      v.crossOrigin = "anonymous";
      v.src = url;
      v.addEventListener("loadeddata", () => {
        v.currentTime = 0.05;
      });
      v.addEventListener("seeked", () => {
        const c = document.createElement("canvas");
        c.width = v.videoWidth;
        c.height = v.videoHeight;
        const ctx = c.getContext("2d");
        if (!ctx) return reject(new Error("Canvas 2D unavailable"));
        ctx.drawImage(v, 0, 0);
        resolve({ frame: c.toDataURL("image/jpeg", 0.9), dur: v.duration });
      }, { once: true });
      v.addEventListener("error", () => reject(new Error("Video load error")));
    });
  }

  function onImgClick(e: React.MouseEvent<HTMLImageElement>) {
    if (points.length >= 2) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setPoints([...points, { x, y }]);
  }

  async function runAnalysis() {
    if (!dataUrl || points.length < 2) return;
    setStage("analyzing");
    setError(null);
    try {
      const vision: any = await import(/* @vite-ignore */ `${MP_URL}/vision_bundle.mjs`);
      const fileset = await vision.FilesetResolver.forVisionTasks(`${MP_URL}/wasm`);
      const landmarker = await vision.PoseLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numPoses: 1,
      });

      const v = document.createElement("video");
      v.muted = true;
      v.playsInline = true;
      v.src = dataUrl;
      await new Promise<void>((res, rej) => {
        v.addEventListener("loadeddata", () => res(), { once: true });
        v.addEventListener("error", () => rej(new Error("Video error")), { once: true });
      });
      const c = document.createElement("canvas");
      c.width = v.videoWidth;
      c.height = v.videoHeight;
      const ctx = c.getContext("2d")!;

      const step = 0.3;
      const times: number[] = [];
      for (let t = 0; t < v.duration; t += step) times.push(t);
      setProgress({ cur: 0, total: times.length });

      const frames: Frame[] = [];
      for (let i = 0; i < times.length; i++) {
        const t = times[i];
        await new Promise<void>((res) => {
          v.addEventListener("seeked", () => res(), { once: true });
          v.currentTime = t;
        });
        ctx.drawImage(v, 0, 0);
        const result = landmarker.detectForVideo(c, Math.round(t * 1000));
        const lm = result.landmarks?.[0];
        if (lm && lm[23] && lm[24]) {
          const nx = (lm[23].x + lm[24].x) / 2;
          const ny = (lm[23].y + lm[24].y) / 2;
          frames.push({ time: t, nx, ny, detected: true });
        } else {
          frames.push({ time: t, nx: 0, ny: 0, detected: false });
        }
        setProgress({ cur: i + 1, total: times.length });
      }

      // Speed calc — use canvas pixel space
      const W = v.videoWidth, H = v.videoHeight;
      const p0 = { x: points[0].x * W, y: points[0].y * H };
      const p1 = { x: points[1].x * W, y: points[1].y * H };
      const axis = { x: p1.x - p0.x, y: p1.y - p0.y };
      const axisLen = Math.hypot(axis.x, axis.y);
      const ux = axis.x / axisLen;
      const uy = axis.y / axisLen;
      const mPerPx = 14 / axisLen;

      const out: Reading[] = [];
      const detected = frames.filter((f) => f.detected);
      for (let i = 1; i < detected.length; i++) {
        const a = detected[i - 1];
        const b = detected[i];
        const dx = (b.nx - a.nx) * W;
        const dy = (b.ny - a.ny) * H;
        const proj = dx * ux + dy * uy;
        const dt = b.time - a.time;
        if (dt <= 0) continue;
        const speed = Math.abs(proj * mPerPx) / dt;
        if (speed < 0.05 || speed > 10) continue;
        out.push({
          time: b.time,
          speed,
          direction: proj >= 0 ? "advance" : "retreat",
        });
      }
      setReadings(out);
      setStage("results");
    } catch (e: any) {
      setError(e?.message ?? "Analysis failed");
      setStage("calibrate");
    }
  }

  function reset() {
    setStage("upload");
    setDataUrl(null);
    setFirstFrame(null);
    setDuration(0);
    setPoints([]);
    setReadings([]);
    setProgress({ cur: 0, total: 0 });
    setError(null);
  }

  function downloadCsv() {
    const lines = ["time_s,speed_ms,direction"];
    for (const r of readings) lines.push(`${r.time.toFixed(3)},${r.speed.toFixed(4)},${r.direction}`);
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "speed-readings.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const peak = readings.reduce((m, r) => Math.max(m, r.speed), 0);
  const avg = readings.length ? readings.reduce((s, r) => s + r.speed, 0) / readings.length : 0;
  const peakAdv = readings.filter((r) => r.direction === "advance").reduce((m, r) => Math.max(m, r.speed), 0);
  const peakRet = readings.filter((r) => r.direction === "retreat").reduce((m, r) => Math.max(m, r.speed), 0);

  return (
    <div className="mt-6 space-y-6">
      {error && (
        <div className="surface p-4 text-sm text-[var(--data-negative)]">{error}</div>
      )}

      {stage === "upload" && (
        <label
          className="surface flex cursor-pointer flex-col items-center justify-center gap-3 p-16 text-center transition-colors hover:border-[var(--accent)]"
          style={{ borderWidth: 2, borderStyle: "dashed" }}
        >
          <Upload className="h-8 w-8 text-[var(--text-secondary)]" />
          <div className="text-sm font-medium">Click to upload a fencing bout video</div>
          <div className="text-xs text-[var(--text-secondary)]">MP4, MOV, WebM — analysed entirely in your browser</div>
          <input
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
          />
        </label>
      )}

      {stage === "extracting" && (
        <div className="surface grid place-items-center p-16 text-sm text-[var(--text-secondary)]">
          Extracting first frame…
        </div>
      )}

      {stage === "calibrate" && firstFrame && (
        <div className="surface p-5">
          <div className="metric-label mb-2">Calibrate the piste</div>
          <p className="mb-4 text-xs text-[var(--text-secondary)]">
            Click the <span style={{ color: "var(--accent)" }}>0m end</span> of the piste, then the{" "}
            <span style={{ color: "var(--fencing)" }}>14m end</span>. Duration: {duration.toFixed(1)}s.
          </p>
          <div style={{ position: "relative", display: "inline-block", maxWidth: "100%" }}>
            <img
              ref={imgRef}
              src={firstFrame}
              alt="First frame"
              onClick={onImgClick}
              style={{ maxWidth: "100%", display: "block", cursor: points.length < 2 ? "crosshair" : "default" }}
            />
            {points.map((p, i) => (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: `${p.x * 100}%`,
                  top: `${p.y * 100}%`,
                  width: 14,
                  height: 14,
                  borderRadius: "50%",
                  background: i === 0 ? "var(--accent)" : "var(--fencing)",
                  border: "2px solid white",
                  transform: "translate(-50%, -50%)",
                  pointerEvents: "none",
                  boxShadow: "0 0 10px rgba(0,0,0,0.5)",
                }}
              />
            ))}
            {points.length === 2 && (
              <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
                <line
                  x1={`${points[0].x * 100}%`}
                  y1={`${points[0].y * 100}%`}
                  x2={`${points[1].x * 100}%`}
                  y2={`${points[1].y * 100}%`}
                  stroke="var(--accent)"
                  strokeWidth={2}
                  strokeDasharray="6 6"
                />
              </svg>
            )}
          </div>
          <div className="mt-4 flex gap-3">
            <button
              onClick={() => setPoints([])}
              className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-default)] px-3 py-1.5 text-xs hover:bg-[var(--bg-elevated)]"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Reset
            </button>
            {points.length === 2 && (
              <button
                onClick={runAnalysis}
                className="rounded-md bg-[var(--accent)] px-4 py-1.5 text-xs font-semibold text-black hover:opacity-90"
              >
                Confirm — Analyze Video
              </button>
            )}
          </div>
        </div>
      )}

      {stage === "analyzing" && (
        <div className="surface p-8">
          <div className="metric-label mb-3">
            Analyzing frame {progress.cur} of {progress.total}
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--bg-elevated)]">
            <div
              className="h-full bg-[var(--accent)] transition-all"
              style={{ width: `${progress.total ? (progress.cur / progress.total) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {stage === "results" && (
        <>
          <div className="grid gap-4 sm:grid-cols-4">
            <StatCard label="Peak speed (m/s)" value={peak.toFixed(2)} />
            <StatCard label="Avg speed (m/s)" value={avg.toFixed(2)} />
            <StatCard label="Peak advance (m/s)" value={peakAdv.toFixed(2)} accent="positive" />
            <StatCard label="Peak retreat (m/s)" value={peakRet.toFixed(2)} accent="negative" />
          </div>

          <div className="surface p-5">
            <div className="metric-label mb-3">Speed over time (m/s)</div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={readings.map((r) => ({ t: r.time.toFixed(1), speed: Number(r.speed.toFixed(3)) }))}>
                  <CartesianGrid stroke="var(--border-subtle)" vertical={false} />
                  <XAxis dataKey="t" tick={{ fill: "var(--text-secondary)", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "var(--text-secondary)", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)", borderRadius: 8, fontSize: 12 }} />
                  <Area type="monotone" dataKey="speed" stroke="var(--fencing)" fill="var(--fencing)" fillOpacity={0.25} strokeWidth={2.5} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="surface overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--border-subtle)]">
              <div className="metric-label">Readings ({readings.length})</div>
              <button
                onClick={downloadCsv}
                className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-default)] px-3 py-1.5 text-xs hover:bg-[var(--bg-elevated)]"
              >
                <Download className="h-3.5 w-3.5" /> Download CSV
              </button>
            </div>
            <div className="max-h-80 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-[var(--bg-elevated)] text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">
                  <tr>
                    <th className="px-5 py-2 text-left">Time (s)</th>
                    <th className="px-5 py-2 text-left">Speed (m/s)</th>
                    <th className="px-5 py-2 text-left">Direction</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {readings.map((r, i) => (
                    <tr key={i} className="row-hover">
                      <td className="px-5 py-2 tabular-nums">{r.time.toFixed(2)}</td>
                      <td className="px-5 py-2 tabular-nums">{r.speed.toFixed(3)}</td>
                      <td className="px-5 py-2">
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                          style={{
                            background: r.direction === "advance" ? "var(--accent-glow)" : "var(--data-negative)" + "26",
                            color: r.direction === "advance" ? "var(--accent)" : "var(--data-negative)",
                          }}
                        >
                          {r.direction}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <button
            onClick={reset}
            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-default)] px-3 py-1.5 text-xs hover:bg-[var(--bg-elevated)]"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Analyze another video
          </button>
        </>
      )}
    </div>
  );
}
