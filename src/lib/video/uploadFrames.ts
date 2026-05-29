import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type KeyframeInsert = Database['public']['Tables']['video_keyframes']['Insert'];

export interface UploadedKeyframe {
  storagePath: string;
  timestamp: number;
  frameIndex: number;
}

export async function uploadFrames(
  blobs: Blob[],
  videoId: string,
  userId: string,
  timestamps: number[],
): Promise<UploadedKeyframe[]> {
  if (blobs.length !== timestamps.length) {
    throw new Error('blobs and timestamps arrays must have equal length');
  }

  const results: UploadedKeyframe[] = [];

  for (let i = 0; i < blobs.length; i++) {
    // Scope under the user's folder so the per-user storage RLS policy allows it.
    const storagePath = `${userId}/keyframes/${videoId}/frame_${i}.jpg`;

    const { error: uploadError } = await supabase.storage
      .from('videos')
      .upload(storagePath, blobs[i], {
        contentType: 'image/jpeg',
        upsert: true,
      });

    if (uploadError) {
      throw new Error(`Storage upload failed for frame ${i}: ${uploadError.message}`);
    }

    // Bucket is private — sign the URL so the keyframe is viewable by the owner.
    const { data: urlData, error: signError } = await supabase.storage
      .from('videos')
      .createSignedUrl(storagePath, 60 * 60 * 24 * 7);

    if (signError || !urlData?.signedUrl) {
      throw new Error(`Signing failed for frame ${i}: ${signError?.message ?? 'no url'}`);
    }

    const record: KeyframeInsert = {
      video_id: videoId,
      user_id: userId,
      frame_index: i,
      timestamp_seconds: timestamps[i],
      thumbnail_url: urlData.signedUrl,
    };


    const { error: insertError } = await supabase
      .from('video_keyframes')
      .insert(record);

    if (insertError) {
      throw new Error(`DB insert failed for frame ${i}: ${insertError.message}`);
    }

    results.push({ storagePath, timestamp: timestamps[i], frameIndex: i });
  }

  return results;
}
