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
    const storagePath = `keyframes/${videoId}/frame_${i}.jpg`;

    const { error: uploadError } = await supabase.storage
      .from('videos')
      .upload(storagePath, blobs[i], {
        contentType: 'image/jpeg',
        upsert: true,
      });

    if (uploadError) {
      throw new Error(`Storage upload failed for frame ${i}: ${uploadError.message}`);
    }

    const { data: urlData } = supabase.storage
      .from('videos')
      .getPublicUrl(storagePath);

    const record: KeyframeInsert = {
      video_id: videoId,
      user_id: userId,
      frame_index: i,
      timestamp_seconds: timestamps[i],
      thumbnail_url: urlData.publicUrl,
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
