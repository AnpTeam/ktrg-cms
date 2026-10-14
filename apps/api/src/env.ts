import { parseEnv } from "./parse-env";

export type { Env } from "./parse-env";

/** Validated at import: the process exits on boot if the environment is wrong. */
export const env = parseEnv(process.env);
