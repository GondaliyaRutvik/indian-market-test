import { NextResponse } from "next/server";
import { checkPassword, issueToken, SESSION_COOKIE, COOKIE_OPTIONS, authDisabled } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (authDisabled()) {
    const res = NextResponse.json({ ok: true, note: "APP_PASSWORD not set — auth disabled" });
    res.cookies.set(SESSION_COOKIE, "open", COOKIE_OPTIONS);
    return res;
  }

  const body = await req.json().catch(() => ({}));
  const password = typeof body.password === "string" ? body.password : "";

  if (!checkPassword(password)) {
    // Small constant delay blunts trivial online guessing.
    await new Promise((r) => setTimeout(r, 600));
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, issueToken(), COOKIE_OPTIONS);
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { ...COOKIE_OPTIONS, maxAge: 0 });
  return res;
}
