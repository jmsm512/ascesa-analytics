/**
 * Vercel Serverless Function (Node.js runtime)
 *
 * Bridges Vercel's Node.js (IncomingMessage / ServerResponse) API to the
 * Web Fetch API handler that TanStack Start produces.
 *
 * This file is a source-tree file that Vercel bundles after `bun run build`
 * has already produced dist/server/. The `includeFiles` config in vercel.json
 * ensures dist/server/** is included in the function package so that the
 * dynamic import inside server.js can resolve its hashed asset chunk.
 */

import server from "../dist/server/server.js";

export const config = {
  maxDuration: 30,
};

export default async function handler(req, res) {
  // Build a fully-qualified URL from Vercel's forwarded headers
  const proto = req.headers["x-forwarded-proto"] ?? "https";
  const host = req.headers["x-forwarded-host"] ?? req.headers.host ?? "localhost";
  const url = `${proto}://${host}${req.url}`;

  // Convert Node.js headers object → Web Fetch Headers
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === "string") {
      headers.set(key, value);
    } else if (Array.isArray(value)) {
      for (const v of value) headers.append(key, v);
    }
  }

  // Buffer the request body for non-GET/HEAD requests
  let body = null;
  if (req.method !== "GET" && req.method !== "HEAD") {
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    if (chunks.length > 0) body = Buffer.concat(chunks);
  }

  const request = new Request(url, {
    method: req.method,
    headers,
    body,
    // Required in Node.js 18+ when body is present
    ...(body ? { duplex: "half" } : {}),
  });

  // Minimal ExecutionContext shim (Cloudflare Workers shape)
  const ctx = {
    waitUntil: (promise) => { promise.catch(console.error); },
    passThroughOnException: () => {},
  };

  let response;
  try {
    response = await server.fetch(request, process.env, ctx);
  } catch (err) {
    console.error("[SSR] handler threw:", err);
    res.statusCode = 500;
    res.setHeader("content-type", "text/plain");
    res.end("Internal Server Error");
    return;
  }

  // Write status + headers
  res.statusCode = response.status;
  for (const [key, value] of response.headers.entries()) {
    // Vercel strips Transfer-Encoding for us; skip to avoid conflicts
    if (key.toLowerCase() === "transfer-encoding") continue;
    res.setHeader(key, value);
  }

  // Stream the response body
  if (response.body) {
    try {
      for await (const chunk of response.body) {
        if (!res.write(chunk)) {
          // Respect backpressure
          await new Promise((resolve) => res.once("drain", resolve));
        }
      }
    } catch (err) {
      console.error("[SSR] stream error:", err);
    }
  }

  res.end();
}
