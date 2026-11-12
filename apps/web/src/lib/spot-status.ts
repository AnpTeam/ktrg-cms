/** A place that offers no stamp right now: closed, or information only (it exists, but there is nothing to stamp). */
export const offersNoStamp = (status: string | undefined | null): boolean => status === "closed" || status === "info";
