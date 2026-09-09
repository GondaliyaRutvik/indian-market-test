/**
 * Kept in its own module with no imports so that middleware (which runs on the
 * edge runtime) can read the cookie name without pulling in node:crypto.
 */
export const SESSION_COOKIE = "nda_session";
/**
 * One year. This is a single-user personal dashboard installed to a phone home
 * screen — being asked for the password again is pure friction, and the value it
 * protects (a bot token) is already re-enterable. The session also slides on use,
 * so an actively used install effectively never expires.
 */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;
/** Reissue the cookie once it is more than halfway through its life. */
export const SESSION_REFRESH_AFTER_SECONDS = SESSION_MAX_AGE_SECONDS / 2;
