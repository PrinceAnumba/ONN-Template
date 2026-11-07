import type { Problem } from "./types";

const TIMEOUT_MS = 15_000;
const DEFAULT_MOCK_ORIGIN = "http://localhost:4000";

export const isMockMode = !process.env.NEXT_PUBLIC_API_BASE;

export class ApiError extends Error {
  readonly status: number;
  readonly problem: Problem;

  constructor(problem: Problem) {
    super(problem.detail ?? problem.title);
    this.name = "ApiError";
    this.status = problem.status;
    this.problem = problem;
  }
}

/** Server code needs an absolute URL; the browser reaches the mock through a Next.js rewrite. */
function apiOrigin() {
  const base = process.env.NEXT_PUBLIC_API_BASE;
  if (base) return base;
  if (typeof window !== "undefined") return "";
  return process.env.MOCK_API_ORIGIN || DEFAULT_MOCK_ORIGIN;
}

export function apiUrl(path: string, query?: Record<string, QueryValue>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  const search = params.size ? `?${params}` : "";
  return `${apiOrigin()}/api/v1${path}${search}`;
}

export type QueryValue = string | number | boolean | undefined;

export interface ApiFetchOptions {
  locale: string;
  query?: Record<string, QueryValue>;
  method?: "GET" | "POST";
  body?: unknown;
  signal?: AbortSignal;
  /** Next.js cache settings for Server Components. */
  next?: { revalidate?: number | false; tags?: string[] };
}

async function toApiError(response: Response) {
  const fallback: Problem = {
    type: "about:blank",
    title: response.statusText || "Request failed",
    status: response.status,
  };
  const problem = await response.json().catch(() => fallback);
  return new ApiError({ ...fallback, ...(problem as Partial<Problem>) });
}

export async function apiFetchRaw(path: string, options: ApiFetchOptions): Promise<Response> {
  const { locale, query, method = "GET", body, signal, next } = options;
  const url = apiUrl(path, query);
  const init = {
    method,
    headers: {
      "Accept-Language": locale,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    next,
  };

  const attempt = () =>
    fetch(url, {
      ...init,
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(TIMEOUT_MS)])
        : AbortSignal.timeout(TIMEOUT_MS),
    });

  let response: Response;
  try {
    response = await attempt();
  } catch (error) {
    if (signal?.aborted) throw error;
    response = await attempt();
  }
  if (!response.ok) throw await toApiError(response);
  return response;
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions): Promise<T> {
  const response = await apiFetchRaw(path, options);
  return response.json() as Promise<T>;
}
