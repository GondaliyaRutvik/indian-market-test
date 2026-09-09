/**
 * Kept in its own module with no imports so that middleware (which runs on the
 * edge runtime) can read the cookie name without pulling in node:crypto.
 */
export const SESSION_COOKIE = "nda_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days
