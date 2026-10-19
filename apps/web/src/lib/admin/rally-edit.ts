// The rules of the rally screens with no React, so they are unit-tested. A rally is made of places or of courses
// (chosen when it is created); the screens show every candidate with a tick box and send the ticked ids in one save.

import type { AdminRally } from "./types";

/** Tick or untick one: a newly ticked one goes to the end, so the order the admin builds is kept. */
export function toggleMember(ids: readonly string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
}

/** Tick every candidate (keeping the ones already ticked first, in their order), or untick all. */
export function tickAll(ids: readonly string[], candidates: readonly string[], on: boolean): string[] {
  return on ? [...ids, ...candidates.filter((c) => !ids.includes(c))] : [];
}

export function sameOrder(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

/** Group items by a key, keeping the order of first appearance (places by course, in trail order). */
export function groupBy<T>(items: readonly T[], keyOf: (item: T) => string): { key: string; items: T[] }[] {
  const out = new Map<string, T[]>();
  for (const item of items) out.set(keyOf(item), [...(out.get(keyOf(item)) ?? []), item]);
  return [...out].map(([key, list]) => ({ key, items: list }));
}

export interface NameDraft {
  nameJa: string;
  nameEn: string;
}

/** Only the names that changed, ready for PATCH; an empty English name clears it. */
export function nameChanges(saved: Pick<AdminRally, "nameJa" | "nameEn">, draft: NameDraft): { nameJa?: string; nameEn?: string | null } {
  const out: { nameJa?: string; nameEn?: string | null } = {};
  if (draft.nameJa.trim() !== saved.nameJa) out.nameJa = draft.nameJa.trim();
  if (draft.nameEn.trim() !== (saved.nameEn ?? "")) out.nameEn = draft.nameEn.trim() || null;
  return out;
}
