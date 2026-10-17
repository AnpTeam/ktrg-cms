// The ID a person sees on their profile and can quote to support. It must be UNIQUE, so support can go straight
// to the account (to check missing stamps or a bug), and it should not read as "user number 7".
//
// It is made from a database sequence: 1, 2, 3 ... multiplied by a constant, modulo a prime, written with 8 digits.
// A multiplier that shares no factor with a prime modulus maps different counters to different numbers, so two
// accounts never get the same ID (for the first 99,999,988 accounts), and consecutive accounts look unrelated.
// It is NOT a secret and grants nothing: never use it for login or access checks.
//
// The database computes it as the column default (see migration 0006 and `users.publicId`); the same arithmetic
// lives here for the in-memory test stores. Keep the three in step.
export const PUBLIC_ID_MULTIPLIER = 48271;
export const PUBLIC_ID_PRIME = 99999989; // the largest prime below 10^8

export function publicIdFor(sequence: number): string {
  return String(Number((BigInt(sequence) * BigInt(PUBLIC_ID_MULTIPLIER)) % BigInt(PUBLIC_ID_PRIME))).padStart(8, "0");
}
