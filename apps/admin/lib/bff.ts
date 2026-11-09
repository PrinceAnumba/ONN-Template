/** Client-side calls to the admin API through the same-origin proxy (`app/bff`), which adds the
 * session's bearer token. Never cached. */
export class BffError extends Error {
  constructor(
    readonly status: number,
    /** The Problem `type` when the API sent one, else "network" or the status. */
    readonly type: string,
    /** Field errors from a 422 Problem (`path` and a message code). */
    readonly errors: { path: string; message: string }[] = [],
  ) {
    super(type);
  }
}

export const BFF = "/admin/bff";

export async function bff<T>(
  path: string,
  init: { method?: "GET" | "POST" | "PUT" | "PATCH"; body?: unknown; signal?: AbortSignal } = {},
): Promise<T> {
  const response = await fetch(`${BFF}${path}`, {
    method: init.method ?? "GET",
    headers: init.body === undefined ? undefined : { "Content-Type": "application/json" },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: "no-store",
    signal: init.signal,
  }).catch(() => {
    throw new BffError(0, "network");
  });
  if (!response.ok) {
    const problem = (await response.json().catch(() => null)) as {
      type?: string;
      errors?: { path: string; message: string }[];
    } | null;
    const type =
      problem?.type && problem.type !== "about:blank" ? problem.type : String(response.status);
    throw new BffError(response.status, type, problem?.errors ?? []);
  }
  return (await response.json()) as T;
}

/** Uploads a form with progress (fetch has no upload progress), resolving with the JSON body. */
export function uploadForm<T>(
  path: string,
  form: FormData,
  onProgress: (fraction: number) => void,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", `${BFF}${path}`);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    request.onerror = () => reject(new BffError(0, "network"));
    request.onload = () => {
      let body: unknown = null;
      try {
        body = JSON.parse(request.responseText);
      } catch {
        // Non-JSON error page: fall through with the status.
      }
      if (request.status >= 200 && request.status < 300) resolve(body as T);
      else {
        const problem = body as {
          type?: string;
          errors?: { path: string; message: string }[];
        } | null;
        const type = problem?.type;
        reject(
          new BffError(
            request.status,
            type && type !== "about:blank" ? type : String(request.status),
            problem?.errors ?? [],
          ),
        );
      }
    };
    request.send(form);
  });
}
