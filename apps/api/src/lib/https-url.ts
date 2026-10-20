/** A photo or source address: an https link, not absurdly long. */
export const isHttpsUrl = (v: string): boolean => {
  if (v.length > 500) return false;
  try {
    return new URL(v).protocol === "https:";
  } catch {
    return false;
  }
};

/** A photo address: an https link, not absurdly long, and (when `hosts` is set) on one of those hosts (PHOTO_HOSTS). */
export const isPhotoUrl = (v: string, hosts: readonly string[]): boolean => {
  if (v.length > 500) return false;
  try {
    const url = new URL(v);
    return url.protocol === "https:" && (hosts.length === 0 || hosts.includes(url.hostname));
  } catch {
    return false;
  }
};
