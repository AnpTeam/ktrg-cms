import { errorKeyFromApi, type ErrorKey } from "../api-error";

// The browser side of the admin API: turns an Eden answer into `{ ok: true, data }` or `{ ok: false, key }`, where
// `key` names the sentence to show (components/useErrorMessages.ts). It never throws: no signal is "network".

interface EdenLike {
  data: unknown;
  error: { status: unknown; value: unknown } | null;
  status: number;
}

export type Outcome<R extends EdenLike> = { ok: true; data: NonNullable<R["data"]> } | { ok: false; key: ErrorKey };

export async function outcome<R extends EdenLike>(call: Promise<R>): Promise<Outcome<R>> {
  try {
    const res = await call;
    if (res.error || res.data == null) {
      const status = typeof res.error?.status === "number" ? res.error.status : res.status;
      return { ok: false, key: status === 0 ? "network" : errorKeyFromApi(status, res.error?.value) };
    }
    return { ok: true, data: res.data as NonNullable<R["data"]> };
  } catch {
    return { ok: false, key: "network" };
  }
}
