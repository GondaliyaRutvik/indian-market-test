import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const denied = await requireSession();
  if (denied) return denied;

  const url = new URL(req.url);
  const take = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 30)));

  const [events, unread] = await Promise.all([
    prisma.alertEvent.findMany({ orderBy: { createdAt: "desc" }, take }),
    prisma.alertEvent.count({ where: { read: false } }),
  ]);

  return NextResponse.json({ events, unread });
}

/** Mark notifications read — a single id, or all of them. */
export async function POST(req: Request) {
  const denied = await requireSession();
  if (denied) return denied;

  const body = await req.json().catch(() => ({}));

  if (body.all === true) {
    await prisma.alertEvent.updateMany({ where: { read: false }, data: { read: true } });
    return NextResponse.json({ ok: true });
  }
  if (typeof body.id === "string") {
    await prisma.alertEvent.update({ where: { id: body.id }, data: { read: true } });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Pass { id } or { all: true }" }, { status: 400 });
}

export async function DELETE() {
  const denied = await requireSession();
  if (denied) return denied;

  await prisma.alertEvent.deleteMany({});
  return NextResponse.json({ ok: true });
}
