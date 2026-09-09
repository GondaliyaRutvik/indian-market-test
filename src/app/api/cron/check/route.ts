import { NextResponse } from "next/server";
import { runCheck } from "@/lib/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
// Mumbai — closest region to the Indian market data sources.
export const preferredRegion = "bom1";

/**
 * The polling endpoint. Call it every few minutes during market hours from any
 * scheduler — GitHub Actions, cron-job.org, Vercel Cron, or your own machine.
 *
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://<app>/api/cron/check
 *
 * `?force=1` bypasses the market-hours guard, which is handy for testing on a
 * weekend.
 */
function authorize(req: Request): boolean {
  const secret = (process.env.CRON_SECRET ?? "").trim();
  if (!secret) return false;

  const header = req.headers.get("authorization") ?? "";
  if (header === `Bearer ${secret}`) return true;

  // Vercel Cron sends its own header; accept the query form for simple schedulers.
  const key = new URL(req.url).searchParams.get("key");
  return key === secret;
}

async function handle(req: Request) {
  if (!authorize(req)) {
    return NextResponse.json(
      { error: "Unauthorized. Send 'Authorization: Bearer <CRON_SECRET>' or ?key=<CRON_SECRET>." },
      { status: 401 },
    );
  }

  const force = new URL(req.url).searchParams.get("force") === "1";

  try {
    const summary = await runCheck({ force });
    return NextResponse.json(summary);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

export const GET = handle;
export const POST = handle;
