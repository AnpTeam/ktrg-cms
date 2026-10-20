/** A photo or source address: an https link, not absurdly long. */
export const isHttpsUrl = (v: string): boolean => {
  if (v.length > 500) return false;
  try {
    return new URL(v).protocol === "https:";
  } catch {
    return false;
  }
};
