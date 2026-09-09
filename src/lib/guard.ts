import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifyToken, issueToken, COOKIE_OPTIONS, tokenNeedsRefresh } from "./auth";

/**
 * Returns a 401 response when the caller has no valid session, else null.
 *
 * A still-valid session past the halfway mark of its life is quietly reissued,
 * so an installed app that gets opened regularly never reaches expiry and never
 * re-prompts for the password.
 */
export async function requireSession(): Promise<NextResponse | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;

  if (!verifyToken(token)) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (tokenNeedsRefresh(token)) {
    try {
      jar.set(SESSION_COOKIE, issueToken(), COOKIE_OPTIONS);
    } catch {
      // Setting cookies is not permitted in every render context; a failure here
      // only means the session is not extended on this particular request.
    }
  }

  return null;
}
