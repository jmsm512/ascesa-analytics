// Supabase Edge Function: fetch-fencing-tracker
// Scrapes a fencer's FencingTracker profile page and caches structured data
// on the athletes row (fencing_tracker_data + fencing_tracker_updated_at).

import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
} as const;

interface RequestBody {
  athlete_id: string;
}

type RatingEntry = { weapon: string; rating: string; date: string };
type TournamentResult = {
  date: string;
  tournament: string;
  event: string;
  place: string;
  event_class: string;
};
type PodiumRow = { season: string; gold: number; silver: number; bronze: number; t8: number; total: number };

interface FencingTrackerData {
  source_url: string;
  name: string | null;
  club: string | null;
  current_rating: string | null;
  rating_history: RatingEntry[];
  total_tournaments: number | null;
  podium_all_time: PodiumRow | null;
  podium_by_season: PodiumRow[];
  recent_results: TournamentResult[];
  fetched_at: string;
}

// Strip HTML tags + decode common entities
function clean(s: string): string {
  return s
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

// Extract all <tr>...</tr> blocks inside a panel matched by an <h2>title</h2>
function extractPanelRows(html: string, title: string): string[] {
  // Find the <h2>title</h2>, then the next <tbody>...</tbody>
  const headingRe = new RegExp(`<h2[^>]*>\\s*${title}\\s*</h2>`, 'i');
  const headingMatch = html.match(headingRe);
  if (!headingMatch) return [];
  const after = html.slice(headingMatch.index! + headingMatch[0].length);
  const tbodyMatch = after.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i);
  if (!tbodyMatch) return [];
  const rows = tbodyMatch[1].match(/<tr[\s\S]*?<\/tr>/gi) ?? [];
  return rows.filter((r) => !r.includes('ranking-table__empty-row'));
}

function extractCells(rowHtml: string): string[] {
  const cells = rowHtml.match(/<t[dh][^>]*>[\s\S]*?<\/t[dh]>/gi) ?? [];
  return cells.map((c) => clean(c.replace(/<t[dh][^>]*>|<\/t[dh]>/gi, '')));
}

function parseFencingTrackerHtml(html: string, sourceUrl: string): FencingTrackerData {
  const nameMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/);
  const clubMatch = html.match(/class="person-hero__club-link"[^>]*>([^<]+)</);

  // Rating history rows: weapon | rating | date
  const ratingRows = extractPanelRows(html, 'Rating history');
  const rating_history: RatingEntry[] = ratingRows
    .map((r) => extractCells(r))
    .filter((c) => c.length >= 3)
    .map((c) => ({ weapon: c[0], rating: c[1], date: c[2] }));
  const current_rating = rating_history[0]?.rating ?? null;

  // Podium finishes — season | gold | silver | bronze | t8 | total
  const podiumRows = extractPanelRows(html, 'Podium finishes');
  const podiumParsed: PodiumRow[] = podiumRows
    .map((r) => extractCells(r))
    .filter((c) => c.length >= 6)
    .map((c) => ({
      season: c[0],
      gold: c[1] === '-' ? 0 : Number(c[1]) || 0,
      silver: c[2] === '-' ? 0 : Number(c[2]) || 0,
      bronze: c[3] === '-' ? 0 : Number(c[3]) || 0,
      t8: c[4] === '-' ? 0 : Number(c[4]) || 0,
      total: c[5] === '-' ? 0 : Number(c[5]) || 0,
    }));
  const podium_all_time = podiumParsed.find((p) => /all time/i.test(p.season)) ?? null;
  const podium_by_season = podiumParsed.filter((p) => !/all time/i.test(p.season));

  // Results table — date | tournament | event | place | rating earned | event class
  const resultRows = extractPanelRows(html, 'Results');
  const recent_results: TournamentResult[] = resultRows
    .map((r) => extractCells(r))
    .filter((c) => c.length >= 6)
    .slice(0, 5)
    .map((c) => ({
      date: c[0],
      tournament: c[1],
      event: c[2],
      place: c[3],
      event_class: c[5],
    }));

  return {
    source_url: sourceUrl,
    name: nameMatch ? clean(nameMatch[1]) : null,
    club: clubMatch ? clean(clubMatch[1]) : null,
    current_rating,
    rating_history,
    total_tournaments: podium_all_time?.total ?? null,
    podium_all_time,
    podium_by_season,
    recent_results,
    fetched_at: new Date().toISOString(),
  };
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    const { athlete_id } = (await req.json()) as RequestBody;
    if (!athlete_id) {
      return new Response(JSON.stringify({ error: 'athlete_id required' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const authHeader = req.headers.get('Authorization') ?? '';
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: athlete, error: aErr } = await supabase
      .from('athletes')
      .select('id, fencing_tracker_url')
      .eq('id', athlete_id)
      .maybeSingle();
    if (aErr) throw aErr;
    if (!athlete?.fencing_tracker_url) {
      return new Response(JSON.stringify({ error: 'No FencingTracker URL set for this athlete' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const url = athlete.fencing_tracker_url as string;
    if (!/^https?:\/\/(www\.)?fencingtracker\.com\//i.test(url)) {
      return new Response(JSON.stringify({ error: 'URL must be a fencingtracker.com profile' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AscesaAnalytics/1.0)',
        Accept: 'text/html',
      },
    });
    if (!res.ok) {
      return new Response(
        JSON.stringify({ error: `FencingTracker returned ${res.status}` }),
        { status: 502, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }
    const html = await res.text();
    const data = parseFencingTrackerHtml(html, url);

    const { error: uErr } = await supabase
      .from('athletes')
      .update({
        fencing_tracker_data: data,
        fencing_tracker_updated_at: new Date().toISOString(),
      })
      .eq('id', athlete_id);
    if (uErr) throw uErr;

    return new Response(JSON.stringify({ data }), {
      status: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});
