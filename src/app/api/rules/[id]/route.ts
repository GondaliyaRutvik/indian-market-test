import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const denied = await requireSession();
  if (denied) return denied;

  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const data: Record<string, unknown> = {};
  if (typeof body.enabled === "boolean") data.enabled = body.enabled;
  if (Number.isFinite(Number(body.thresholdPct))) {
    const t = Number(body.thresholdPct);
    if (t > 0 && t <= 50) data.thresholdPct = t;
  }
  if (Number.isFinite(Number(body.cooldownMinutes))) {
    data.cooldownMinutes = Math.max(1, Math.min(1440, Math.round(Number(body.cooldownMinutes))));
  }
  if (Array.isArray(body.channels) && body.channels.length) {
    data.channels = body.channels
      .filter((c: string) => ["telegram", "email", "inapp"].includes(c))
      .join(",");
  }
  // Clearing the cooldown lets the rule fire again immediately.
  if (body.resetCooldown === true) data.lastTriggeredAt = null;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  try {
    const rule = await prisma.alertRule.update({ where: { id }, data });
    return NextResponse.json({ rule });
  } catch {
    return NextResponse.json({ error: "Rule not found" }, { status: 404 });
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const denied = await requireSession();
  if (denied) return denied;

  const { id } = await params;
  try {
    await prisma.alertRule.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Rule not found" }, { status: 404 });
  }
}
