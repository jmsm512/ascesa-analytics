-- Grant SELECT, INSERT, UPDATE, DELETE to authenticated role on all user-facing tables.
-- RLS policies enforce row-level isolation; these grants allow the API to reach the tables at all.

grant select, insert, update, delete on public.athletes            to authenticated;
grant select, insert, update, delete on public.sessions            to authenticated;
grant select, insert, update, delete on public.profiles            to authenticated;
grant select, insert, update, delete on public.athlete_benchmarks  to authenticated;
grant select, insert, update, delete on public.athlete_goals       to authenticated;
grant select, insert, update, delete on public.fencing_sessions    to authenticated;
grant select, insert, update, delete on public.fencing_actions     to authenticated;
grant select, insert, update, delete on public.fencing_sensor_reps to authenticated;
grant select, insert, update, delete on public.hockey_sprint_sessions to authenticated;
grant select, insert, update, delete on public.hockey_sprint_reps  to authenticated;
grant select, insert, update, delete on public.hockey_step_data    to authenticated;
grant select, insert, update, delete on public.videos              to authenticated;
grant select, insert, update, delete on public.video_keyframes     to authenticated;
grant select, insert, update, delete on public.video_pose_metrics  to authenticated;
grant select, insert, update, delete on public.video_ai_feedback   to authenticated;
