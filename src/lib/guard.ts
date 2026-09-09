import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifyToken } from "./auth";

/** Returns a 401 response when the caller has no valid session, else null. */
export async function requireSession(): Promise<NextResponse | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (verifyToken(token)) return null;
  return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
}
