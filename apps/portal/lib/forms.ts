import { ApiError } from "@onn/api-client";
import { routing } from "@/i18n/routing";

export const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
export const MESSAGE_MAX = 2000;

/** The locale a form posted, checked against the enabled ones. */
export function formLocale(formData: FormData) {
  const value = String(formData.get("locale") ?? "");
  return (routing.locales as readonly string[]).includes(value) ? value : routing.defaultLocale;
}

export const text = (formData: FormData, name: string) => String(formData.get(name) ?? "").trim();

/** Field paths from a 422 Problem, so server-side rules show next to the right field. */
export function problemFields(error: unknown): string[] {
  return error instanceof ApiError && error.status === 422
    ? (error.problem.errors ?? []).map((item) => item.path)
    : [];
}

/** Only same-site paths go back into links ("Back to where you were"). */
export function safePath(value: string) {
  return /^\/(?!\/)[^\s]{0,300}$/.test(value) ? value : "/";
}

/** Error ids come from Next's error digest or our own fallback: short, URL-safe tokens. */
export function safeErrorId(value: string) {
  return /^[\w-]{1,64}$/.test(value) ? value : undefined;
}
