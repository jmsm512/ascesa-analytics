import { supabase } from "@/integrations/supabase/client";

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
};

export type Session = {
  id: string;
  athlete_id: string;
  sport: string;
  session_type: string;
  session_date: string;
  location: string | null;
  notes: string | null;
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
  return { session, fs, actions, sensors };
}

export async function listVideosForAthlete(athleteId: string) {
  const { data } = await supabase.from("videos").select("*").eq("athlete_id", athleteId).order("created_at", { ascending: false });
  return data ?? [];
}

export async function getVideo(id: string) {
  const { data } = await supabase.from("videos").select("*, athletes(name, sport, age)").eq("id", id).maybeSingle();
  return data;
}
