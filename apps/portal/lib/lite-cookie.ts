/** Shared by the server reader, the route handler and the client toggle. */
export const LITE_COOKIE = "onn-lite";
export const LITE_MAX_AGE = 60 * 60 * 24 * 365;

/** `1` on, `0` off: an explicit `0` overrides `Save-Data` and the connection check. */
export function liteCookie(on: boolean) {
  return `${LITE_COOKIE}=${on ? "1" : "0"}; Path=/; Max-Age=${LITE_MAX_AGE}; SameSite=Lax`;
}
