import { createClient } from 'npm:@supabase/supabase-js@2';
import Anthropic from 'npm:@anthropic-ai/sdk';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
} as const;

type Sport = 'hockey' | 'fencing';

interface RequestBody {
  keyframe_id: string;
  sport: Sport;
  athlete_name: string;
  age: number;
}

interface CoachingIssue {
  category: string;
  observation: string;
  cue: string;
}

interface CoachingResponse {
  analysis: string;
  issues: CoachingIssue[];
  actionable_cues: string[];
}

function buildHockeyPrompt(athleteName: string, age: number): string {
  return `You are an elite skating coach reviewing a single video frame of ${athleteName}, age ${age}.

Analyze the skating mechanics visible in this frame across these five areas:

1. **Push-off power** — Is the pushing leg achieving full extension? Look for complete straightening at the hip, knee, and ankle (triple extension).
2. **Knee bend** — Assess the depth of knee flexion on the gliding/support leg. Optimal range is 90–110° at peak load.
3. **Hip extension** — Are the hips driving forward and fully extended through the push? Look for hip position relative to the torso.
4. **Stride symmetry** — Does the stride appear balanced left-to-right? Note any asymmetries in limb position or lean angle.
5. **Upper body position** — Evaluate arm swing mechanics, shoulder level, and head/chin position relative to the direction of travel.

Respond with ONLY valid JSON in this exact shape — no markdown, no preamble:
{
  "analysis": "<2–3 sentence overall coaching assessment>",
  "issues": [
    { "category": "<one of: push-off power | knee bend | hip extension | stride symmetry | upper body>", "observation": "<what you see>", "cue": "<specific actionable correction>" }
  ],
  "actionable_cues": ["<cue 1>", "<cue 2>", "<cue 3>"]
}

Provide exactly 2–3 entries in actionable_cues. If the frame does not show a skater clearly, set analysis to "Frame does not contain sufficient skating mechanics to assess" and return empty arrays.`;
}

function buildFencingPrompt(athleteName: string, age: number): string {
  return `You are an elite fencing coach reviewing a single video frame of ${athleteName}, age ${age}.

Analyze the fencing technique visible in this frame across these five areas:

1. **Guard position** — Evaluate the weapon hand height, pronation/supination, and the angle and alignment of the blade relative to the target line.
2. **Weapon arm extension** — Assess elbow extension, wrist alignment, and whether the arm is straight or bent at the point of action. Check for telegraphing shoulder movement.
3. **Footwork stance** — Analyze the en garde position: foot width (roughly shoulder-width), front foot direction (forward), rear foot perpendicular, knees bent over toes.
4. **Lunge mechanics** — If a lunge is visible: check front knee is tracking over the front toe, rear leg is fully extended and driving, and the torso is upright or slightly forward.
5. **Balance** — Assess center of mass height, head position (upright, not drooping), and shoulder levelness to detect over-commitment or recovery issues.

Respond with ONLY valid JSON in this exact shape — no markdown, no preamble:
{
  "analysis": "<2–3 sentence overall coaching assessment>",
  "issues": [
    { "category": "<one of: guard position | weapon arm extension | footwork stance | lunge mechanics | balance>", "observation": "<what you see>", "cue": "<specific actionable correction>" }
  ],
  "actionable_cues": ["<cue 1>", "<cue 2>", "<cue 3>"]
}

Provide exactly 2–3 entries in actionable_cues. If the frame does not show a fencer clearly, set analysis to "Frame does not contain sufficient fencing technique to assess" and return empty arrays.`;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  // Process in chunks to avoid call-stack limits on large frames
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
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

  const { keyframe_id, sport, athlete_name, age } = body;

  if (!keyframe_id || !sport || !athlete_name || !age) {
    return jsonResponse({ error: 'Missing required fields: keyframe_id, sport, athlete_name, age' }, 400);
  }

  if (sport !== 'hockey' && sport !== 'fencing') {
    return jsonResponse({ error: 'sport must be "hockey" or "fencing"' }, 400);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');

  if (!supabaseUrl || !serviceRoleKey || !anthropicApiKey) {
    return jsonResponse({ error: 'Server misconfiguration: missing environment variables' }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Fetch the keyframe record
  const { data: keyframe, error: keyframeError } = await supabase
    .from('video_keyframes')
    .select('id, video_id, user_id, thumbnail_url, timestamp_seconds, frame_index')
    .eq('id', keyframe_id)
    .single();

  if (keyframeError || !keyframe) {
    return jsonResponse({ error: 'Keyframe not found' }, 404);
  }

  if (!keyframe.thumbnail_url) {
    return jsonResponse({ error: 'Keyframe has no associated image' }, 422);
  }

  // Download the frame image
  let imageBuffer: ArrayBuffer;
  try {
    const imageRes = await fetch(keyframe.thumbnail_url);
    if (!imageRes.ok) {
      throw new Error(`HTTP ${imageRes.status} ${imageRes.statusText}`);
    }
    imageBuffer = await imageRes.arrayBuffer();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: `Failed to fetch frame image: ${msg}` }, 502);
  }

  const base64Image = arrayBufferToBase64(imageBuffer);

  const prompt = sport === 'hockey'
    ? buildHockeyPrompt(athlete_name, age)
    : buildFencingPrompt(athlete_name, age);

  // Call Anthropic
  const anthropic = new Anthropic({ apiKey: anthropicApiKey });

  let responseText: string;
  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: 'image/jpeg', data: base64Image },
            },
            { type: 'text', text: prompt },
          ],
        },
      ],
    });

    const firstBlock = message.content[0];
    responseText = firstBlock.type === 'text' ? firstBlock.text : '';
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: `Anthropic API error: ${msg}` }, 502);
  }

  // Parse structured response; fall back gracefully if JSON is malformed
  let coaching: CoachingResponse;
  try {
    coaching = JSON.parse(responseText) as CoachingResponse;
  } catch {
    coaching = { analysis: responseText, issues: [], actionable_cues: [] };
  }

  // Persist to video_ai_feedback
  const { error: insertError } = await supabase
    .from('video_ai_feedback')
    .insert({
      video_id: keyframe.video_id,
      user_id: keyframe.user_id,
      feedback: JSON.stringify({
        keyframe_id,
        frame_index: keyframe.frame_index,
        timestamp_seconds: keyframe.timestamp_seconds,
        sport,
        ...coaching,
      }),
      model: 'claude-sonnet-4-6',
    });

  if (insertError) {
    return jsonResponse({ error: `Failed to store feedback: ${insertError.message}` }, 500);
  }

  return jsonResponse({ success: true, keyframe_id, coaching }, 200);
});
