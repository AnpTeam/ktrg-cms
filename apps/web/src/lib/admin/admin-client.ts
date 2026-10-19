import { errorKeyFromApi, isServerCode, type ErrorKey } from "../api-error";

// The browser side of the admin API: turns an Eden answer into `{ ok: true, data }` or `{ ok: false, key }`, where
// `key` names the sentence to show (components/useErrorMessages.ts). It never throws: no signal is "network".

interface EdenLike {
  data: unknown;
  error: { status: unknown; value: unknown } | null;
  status: number;
}

/** The success shape of an answer: the API sends `{ ok: true, ... }` or `{ ok: false, error }`, and only the first is data. */
type Success<R extends EdenLike> = Extract<NonNullable<R["data"]>, { ok: true }>;

export type Outcome<R extends EdenLike> = { ok: true; data: Success<R> } | { ok: false; key: ErrorKey };

export async function outcome<R extends EdenLike>(call: Promise<R>): Promise<Outcome<R>> {
  try {
    const res = await call;
    const body = res.data as { ok?: unknown; error?: unknown } | null;
    if (!res.error && body && body.ok === true) return { ok: true, data: res.data as Success<R> };
    if (body && body.ok === false && isServerCode(body.error)) return { ok: false, key: body.error };
    const status = typeof res.error?.status === "number" ? res.error.status : res.status;
    return { ok: false, key: status === 0 ? "network" : errorKeyFromApi(status, res.error?.value) };
  } catch {
    return { ok: false, key: "network" };
  }
}
