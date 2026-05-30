-- Back-fill fencing_sessions rows for any fencing-sport sessions that are
-- missing one (e.g. sessions created before migration or where the insert
-- silently failed). Safe to run multiple times — uses WHERE NOT EXISTS.

INSERT INTO public.fencing_sessions (session_id, user_id, weapon, opponent, touches_scored, touches_received, result)
SELECT
  s.id        AS session_id,
  s.user_id,
  -- Normalize weapon to the values the check constraint accepts
  CASE
    WHEN lower(a.weapon) LIKE '%ep%e%' THEN 'epee'   -- Épée, epee, épée
    WHEN lower(a.weapon) LIKE 'foil'   THEN 'foil'
    WHEN lower(a.weapon) LIKE 'sabr%'  THEN 'sabre'
    WHEN lower(a.weapon) LIKE 'saber'  THEN 'sabre'
    ELSE NULL                                          -- NULL passes the check
  END         AS weapon,
  'Unknown'   AS opponent,
  0           AS touches_scored,
  0           AS touches_received,
  'draw'      AS result
FROM public.sessions s
JOIN public.athletes a ON a.id = s.athlete_id
WHERE s.sport = 'fencing'
  AND NOT EXISTS (
    SELECT 1 FROM public.fencing_sessions fs WHERE fs.session_id = s.id
  );
