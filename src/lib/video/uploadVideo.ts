import { supabase } from "@/integrations/supabase/client";

export interface UploadedVideo {
  path: string;
  /** Short-lived (1 hour) signed URL for immediate post-upload use. Re-sign on every load. */
  signedUrl: string;
}

/**
 * Upload a video file directly to the `videos` bucket using XHR so we can
 * report real byte-level progress. Returns the storage path + public URL.
 * Streams the upload — no in-memory base64 conversion, so there is no
 * practical file size limit.
 */
export async function uploadVideoToStorage(
  file: File,
  path: string,
  onProgress: (pct: number) => void,
): Promise<UploadedVideo> {
  const { data: sess } = await supabase.auth.getSession();
  const token = sess.session?.access_token;
  const base = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const apikey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
  if (!token || !base || !apikey) {
    throw new Error("Not signed in — please sign in again before uploading.");
  }

  const url = `${base}/storage/v1/object/videos/${path}`;
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url, true);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("apikey", apikey);
    xhr.setRequestHeader("x-upsert", "true");
    xhr.setRequestHeader("Content-Type", file.type || "video/mp4");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress(Math.min(99, Math.round((e.loaded / e.total) * 100)));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload failed (${xhr.status}): ${xhr.responseText || xhr.statusText}`));
    };
    xhr.onerror = () => reject(new Error("Upload network error"));
    xhr.onabort = () => reject(new Error("Upload aborted"));
    xhr.send(file);
  });
  onProgress(100);

  // Bucket is private — issue a long-lived signed URL for streaming/analysis.
  const { data: signed, error: signErr } = await supabase.storage
    .from("videos")
    .createSignedUrl(path, 60 * 60 * 24 * 7);
  if (signErr || !signed?.signedUrl) {
    throw new Error(`Failed to sign uploaded video: ${signErr?.message ?? "no url"}`);
  }
  return { path, publicUrl: signed.signedUrl };
}

