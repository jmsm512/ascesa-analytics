import { supabase } from "@/integrations/supabase/client";

export type FencingTrackerData = {
  source_url: string;
  name: string | null;
  club: string | null;
  current_rating: string | null;
  rating_history: { weapon: string; rating: string; date: string }[];
  total_tournaments: number | null;
  podium_all_time: { season: string; gold: number; silver: number; bronze: number; t8: number; total: number } | null;
  podium_by_season: { season: string; gold: number; silver: number; bronze: number; t8: number; total: number }[];
  recent_results: { date: string; tournament: string; event: string; place: string; event_class: string }[];
  fetched_at: string;
};

export type Athlete = {
  id: string;
  name: string;
  sport: "hockey" | "fencing";
  age: number | null;
  height_cm: number | null;
  weight_kg: number | null;
  position: string | null;
  weapon: string | null;
  team: string | null;
  club: string | null;
  rating: string | null;
  fencing_tracker_url: string | null;
  fencing_tracker_data: FencingTrackerData | null;
  fencing_tracker_updated_at: string | null;
};

export type Session = {
  id: string;
  athlete_id: string;
  sport: string;
  session_type: string;
  session_date: string;
  location: string | null;
  notes: string | null;
  name: string | null;
  video_url: string | null;
};

export async function listAthletes() {
  const { data, error } = await supabase.from("athletes").select("*").order("created_at");
  if (error) throw error;
  return data as Athlete[];
}

export async function getAthlete(id: string) {
  const { data, error } = await supabase.from("athletes").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as Athlete | null;
}

export async function listSessionsForAthlete(athleteId: string) {
  const { data, error } = await supabase
    .from("sessions")
    .select("*")
    .eq("athlete_id", athleteId)
    .order("session_date", { ascending: false });
  if (error) throw error;
  return data as Session[];
}

export async function listRecentSessions(limit = 5) {
  const { data, error } = await supabase
    .from("sessions")
    .select("*, athletes(name, sport)")
    .order("session_date", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function getBenchmarks(athleteId: string) {
  const { data, error } = await supabase
    .from("athlete_benchmarks")
    .select("*")
    .eq("athlete_id", athleteId);
  if (error) throw error;
  return data ?? [];
}

export async function getGoals(athleteId: string) {
  const { data, error } = await supabase
    .from("athlete_goals")
    .select("*")
    .eq("athlete_id", athleteId);
  if (error) throw error;
  return data ?? [];
}

export async function getHockeySession(sessionId: string) {
  const { data: session } = await supabase.from("sessions").select("*").eq("id", sessionId).maybeSingle();
  const { data: hss } = await supabase
    .from("hockey_sprint_sessions")
    .select("*")
    .eq("session_id", sessionId)
    .maybeSingle();
  let reps: any[] = [];
  if (hss) {
    const { data } = await supabase
      .from("hockey_sprint_reps")
      .select("*")
      .eq("hockey_session_id", hss.id)
      .order("rep_number");
    reps = data ?? [];
  }
  return { session, hss, reps };
}

export async function getFencingSession(sessionId: string) {
  const { data: session } = await supabase.from("sessions").select("*").eq("id", sessionId).maybeSingle();
  const { data: fs } = await supabase
    .from("fencing_sessions")
    .select("*")
    .eq("session_id", sessionId)
    .maybeSingle();
  let actions: any[] = [];
  let sensors: any[] = [];
  if (fs) {
    const a = await supabase.from("fencing_actions").select("*").eq("fencing_session_id", fs.id).order("timestamp_seconds");
    actions = a.data ?? [];
    const s = await supabase.from("fencing_sensor_reps").select("*").eq("fencing_session_id", fs.id).order("rep_number");
    sensors = s.data ?? [];
  }

  // Prefer video stored on the fencing_sessions row; fall back to videos table
  let videoPath: string | null = (fs as any)?.video_url ?? (session as any)?.video_url ?? null;
  if (!videoPath) {
    const { data: video } = await supabase
      .from("videos")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    videoPath = video?.video_url ?? null;
  }
  let videoUrl: string | null = null;
  if (videoPath) {
    const { data: signed } = await supabase.storage
      .from("videos")
      .createSignedUrl(videoPath, 60 * 60);
    videoUrl = signed?.signedUrl ?? null;
  }

  return { session, fs, actions, sensors, videoUrl, videoPath, speedAnalysis: (fs as any)?.speed_analysis ?? null };
}

export async function listVideosForAthlete(athleteId: string) {
  const { data } = await supabase.from("videos").select("*").eq("athlete_id", athleteId).order("created_at", { ascending: false });
  return data ?? [];
}

export async function getVideo(id: string) {
  const { data } = await supabase.from("videos").select("*, athletes(name, sport, age)").eq("id", id).maybeSingle();
  return data;
}
