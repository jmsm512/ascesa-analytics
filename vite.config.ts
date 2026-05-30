// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { readFileSync } from "fs";
import { resolve } from "path";

// Parse .env.local at config time so non-VITE_ server-only vars (e.g. ANTHROPIC_API_KEY)
// are available to TanStack Start server functions via process.env.
function parseEnvFile(filePath: string): Record<string, string> {
  try {
    return Object.fromEntries(
      readFileSync(filePath, "utf-8")
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith("#") && l.includes("="))
        .map((l) => {
          const eq = l.indexOf("=");
          return [l.slice(0, eq).trim(), l.slice(eq + 1).trim().replace(/^["']|["']$/g, "")];
        }),
    );
  } catch {
    return {};
  }
}
const localEnv = parseEnvFile(resolve(process.cwd(), ".env.local"));

// Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
// @cloudflare/vite-plugin builds from this — wrangler.jsonc main alone is insufficient.
export default defineConfig({
  cloudflare: false,   // disable Cloudflare Workers adapter — deploying to Vercel
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    define: {
      // Expose server-only env vars to SSR/server-function code.
      // TanStack Start strips server function bodies from client bundles,
      // so these values are never sent to the browser.
      // process.env wins for CI/Vercel builds; .env.local wins locally
      "process.env.ANTHROPIC_API_KEY": JSON.stringify(
        process.env.ANTHROPIC_API_KEY ?? localEnv.ANTHROPIC_API_KEY ?? ""
      ),
    },
  },
});
