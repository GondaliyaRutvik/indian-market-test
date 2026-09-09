import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/guard";
import { INDEX_BY_SYMBOL } from "@/lib/instruments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_CHANNELS = ["telegram", "email", "inapp"];

export async function GET() {
  const denied = await requireSession();
  if (denied) return denied;

  const rules = await prisma.alertRule.findMany({ orderBy: { createdAt: "asc" } });
  return NextResponse.json({ rules });
}

export async function POST(req: Request) {
  const denied = await requireSession();
  if (denied) return denied;

  const body = await req.json().catch(() => ({}));

  const symbol = String(body.symbol ?? "");
  const index = INDEX_BY_SYMBOL[symbol];
  if (!index) {
    return NextResponse.json({ error: `Unknown index symbol: ${symbol}` }, { status: 400 });
  }

  const thresholdPct = Number(body.thresholdPct);
  if (!Number.isFinite(thresholdPct) || thresholdPct <= 0 || thresholdPct > 50) {
    return NextResponse.json(
      { error: "thresholdPct must be a number between 0 and 50" },
      { status: 400 },
    );
  }

  const direction = body.direction === "up" ? "up" : "down";
  const basis = body.basis === "dayHigh" ? "dayHigh" : "prevClose";

  const channels: string[] = Array.isArray(body.channels)
    ? body.channels.filter((c: string) => VALID_CHANNELS.includes(c))
    : ["telegram", "email", "inapp"];
  if (channels.length === 0) {
    return NextResponse.json({ error: "Pick at least one alert channel" }, { status: 400 });
  }

  const cooldownMinutes = Number.isFinite(Number(body.cooldownMinutes))
    ? Math.max(1, Math.min(1440, Math.round(Number(body.cooldownMinutes))))
    : 120;

  const rule = await prisma.alertRule.create({
    data: {
      symbol,
      label: index.name,
      direction,
      thresholdPct,
      basis,
      cooldownMinutes,
      channels: channels.join(","),
      enabled: body.enabled !== false,
    },
  });

  return NextResponse.json({ rule }, { status: 201 });
}
