import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
} as const;

type Sport = 'hockey' | 'fencing';

interface RequestBody {
  video_id: string;
  sport: Sport;
  athlete_name: string;
  age: number;
}

interface FrameResult {
  keyframe_id: string;
  frame_index: number | null;
  success: boolean;
  error?: string;
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  let body: RequestBody;
  try {
    body = await req.json() as RequestBody;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const { video_id, sport, athlete_name, age } = body;

  if (!video_id || !sport || !athlete_name || !age) {
    return jsonResponse({ error: 'Missing required fields: video_id, sport, athlete_name, age' }, 400);
  }

  if (sport !== 'hockey' && sport !== 'fencing') {
    return jsonResponse({ error: 'sport must be "hockey" or "fencing"' }, 400);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: 'Server misconfiguration: missing environment variables' }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Verify the video exists
  const { data: video, error: videoError } = await supabase
    .from('videos')
    .select('id, status')
    .eq('id', video_id)
    .single();

  if (videoError || !video) {
    return jsonResponse({ error: 'Video not found' }, 404);
  }

  // Mark as processing
  const { error: processingError } = await supabase
    .from('videos')
    .update({ status: 'processing' })
    .eq('id', video_id);

  if (processingError) {
    return jsonResponse({ error: `Failed to update video status: ${processingError.message}` }, 500);
  }

  // Fetch all keyframes ordered by frame_index
  const { data: keyframes, error: keyframesError } = await supabase
    .from('video_keyframes')
    .select('id, frame_index, thumbnail_url')
    .eq('video_id', video_id)
    .order('frame_index', { ascending: true });

  if (keyframesError) {
    await supabase.from('videos').update({ status: 'pending' }).eq('id', video_id);
    return jsonResponse({ error: `Failed to fetch keyframes: ${keyframesError.message}` }, 500);
  }

  if (!keyframes || keyframes.length === 0) {
    await supabase.from('videos').update({ status: 'complete' }).eq('id', video_id);
    return jsonResponse({ success: true, video_id, frames_processed: 0, results: [] }, 200);
  }

  // Analyze each frame via the analyze-frame function (best-effort: failures don't abort)
  const analyzeFrameUrl = `${supabaseUrl}/functions/v1/analyze-frame`;
  const results: FrameResult[] = [];

  for (const keyframe of keyframes) {
    // Skip frames with no image — nothing to analyze
    if (!keyframe.thumbnail_url) {
      results.push({ keyframe_id: keyframe.id, frame_index: keyframe.frame_index, success: false, error: 'No image' });
      continue;
    }

    try {
      const res = await fetch(analyzeFrameUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceRoleKey}`,
          'apikey': serviceRoleKey,
        },
        body: JSON.stringify({ keyframe_id: keyframe.id, sport, athlete_name, age }),
      });

      if (res.ok) {
        results.push({ keyframe_id: keyframe.id, frame_index: keyframe.frame_index, success: true });
      } else {
        const errBody = await res.json().catch(() => ({ error: `HTTP ${res.status}` })) as { error?: string };
        results.push({
          keyframe_id: keyframe.id,
          frame_index: keyframe.frame_index,
          success: false,
          error: errBody.error ?? `HTTP ${res.status}`,
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({ keyframe_id: keyframe.id, frame_index: keyframe.frame_index, success: false, error: msg });
    }
  }

  // Mark video complete regardless of per-frame errors
  await supabase.from('videos').update({ status: 'complete' }).eq('id', video_id);

  const succeeded = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  return jsonResponse({
    success: true,
    video_id,
    frames_processed: succeeded,
    frames_failed: failed,
    results,
  }, 200);
});
