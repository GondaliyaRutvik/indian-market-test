/**
 * Fires the alert check against a running app, without waiting for cron.
 *
 *   npm run check                 # local, respects market hours
 *   npm run check -- --force      # ignore market hours (useful on a weekend)
 *   APP_URL=https://your.app npm run check
 */
import { readFileSync } from "fs";

// Minimal .env reader so this works without extra dependencies.
function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    try {
      for (const line of readFileSync(file, "utf8").split("\n")) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (m && !process.env[m[1]]) {
          process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
        }
      }
    } catch {
      /* file absent — fine */
    }
  }
}

loadEnv();

const base = process.env.APP_URL ?? "http://localhost:3000";
const secret = process.env.CRON_SECRET;
const force = process.argv.includes("--force");

if (!secret) {
  console.error("CRON_SECRET is not set. Add it to .env.local first.");
  process.exit(1);
}

const url = `${base}/api/cron/check${force ? "?force=1" : ""}`;
console.log(`POST ${url}\n`);

const res = await fetch(url, {
  method: "POST",
  headers: { Authorization: `Bearer ${secret}` },
});

const json = await res.json().catch(() => ({ error: "non-JSON response" }));
console.log(JSON.stringify(json, null, 2));
process.exit(res.ok ? 0 : 1);
