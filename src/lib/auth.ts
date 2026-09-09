import { createHmac, timingSafeEqual } from "crypto";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  SESSION_REFRESH_AFTER_SECONDS,
} from "./session-cookie";

/**
 * Deliberately minimal single-user gate. The app is deployed on a public URL and
 * stores a Telegram bot token, so it must not be world-readable — but it has no
 * concept of multiple accounts, so a signed cookie over one shared password is
 * the right size of solution.
 */

export { SESSION_COOKIE };
const MAX_AGE_SECONDS = SESSION_MAX_AGE_SECONDS;

function secret(): string {
  return process.env.APP_PASSWORD ?? "";
}

export function authDisabled(): boolean {
  return secret().trim() === "";
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

export function issueToken(): string {
  const expires = Date.now() + MAX_AGE_SECONDS * 1000;
  const payload = String(expires);
  return `${payload}.${sign(payload)}`;
}

export function verifyToken(token: string | undefined): boolean {
  if (authDisabled()) return true;
  if (!token) return false;

  const [payload, mac] = token.split(".");
  if (!payload || !mac) return false;

  const expected = sign(payload);
  const a = Buffer.from(mac, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;

  return Number(payload) > Date.now();
}

/** True when a valid token is past the halfway point of its lifetime. */
export function tokenNeedsRefresh(token: string | undefined): boolean {
  if (authDisabled() || !token) return false;
  const [payload] = token.split(".");
  const expires = Number(payload);
  if (!Number.isFinite(expires)) return false;
  const remaining = (expires - Date.now()) / 1000;
  return remaining < SESSION_REFRESH_AFTER_SECONDS;
}

export function checkPassword(candidate: string): boolean {
  const expected = secret();
  if (!expected) return true;
  const a = Buffer.from(candidate, "utf8");
  const b = Buffer.from(expected, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

export const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: MAX_AGE_SECONDS,
};
