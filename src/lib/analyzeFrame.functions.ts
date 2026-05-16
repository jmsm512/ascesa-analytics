import { createServerFn } from "@tanstack/react-start";

type Result = { nx: number; ny: number; found: boolean };

const PROMPT =
  'This is a frame from a fencing bout. Find the fencer wearing the MERRIMAN USA jacket (or if not visible, the primary fencer closest to camera). Return ONLY JSON with no markdown: {nx: 0.5, ny: 0.5, found: true} where nx is normalized x position 0(left) to 1(right) and ny is normalized y position 0(top) to 1(bottom) of the athlete\'s hip midpoint. If no fencer detected: {nx: 0, ny: 0, found: false}';

export const analyzeFrameFn = createServerFn({ method: "POST" })
  .inputValidator((input: { imageBase64: string }) => {
    if (!input || typeof input.imageBase64 !== "string" || input.imageBase64.length === 0) {
      throw new Error("imageBase64 required");
    }
    return input;
  })
  .handler(async ({ data }): Promise<Result> => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 200,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: "image/jpeg", data: data.imageBase64 },
              },
              { type: "text", text: PROMPT },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Anthropic API ${res.status}: ${text}`);
    }
    const json: any = await res.json();
    const text: string = json?.content?.[0]?.text ?? "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return { nx: 0, ny: 0, found: false };
    try {
      // Tolerate unquoted keys from the model
      const normalized = match[0].replace(/([{,]\s*)([a-zA-Z_]\w*)\s*:/g, '$1"$2":');
      const parsed = JSON.parse(normalized);
      return {
        nx: Number(parsed.nx) || 0,
        ny: Number(parsed.ny) || 0,
        found: Boolean(parsed.found),
      };
    } catch {
      return { nx: 0, ny: 0, found: false };
    }
  });
