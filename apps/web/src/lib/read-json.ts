// The body of a fetch answer as JSON, or null when it is not JSON (an empty body, or an error page from a proxy).
// The type is what the caller expects of a well-formed answer; the caller still checks the fields it uses.
export const readJson = <T = unknown>(res: Response): Promise<T | null> => res.json().catch(() => null) as Promise<T | null>;
