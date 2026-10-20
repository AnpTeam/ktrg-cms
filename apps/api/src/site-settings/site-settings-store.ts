import { eq, sql } from "drizzle-orm";
import { writeAudit } from "../audit/audit-store";
import type { Db } from "../db/client";
import { siteSettings } from "../db/schema";
import { SETTING_AUDIT, SETTING_TARGET, type SiteSettingsStore } from "./site-settings";

export function createDrizzleSiteSettingsStore(db: Db): SiteSettingsStore {
  return {
    async get(key) {
      const [row] = await db.select({ value: siteSettings.value }).from(siteSettings).where(eq(siteSettings.key, key)).limit(1);
      return row?.value ?? null;
    },
    async set(actor, key, value) {
      await db.transaction(async (tx) => {
        await tx
          .insert(siteSettings)
          .values({ key, value })
          .onConflictDoUpdate({ target: siteSettings.key, set: { value, updatedAt: sql`clock_timestamp()` } });
        await writeAudit(tx, { actorUserId: actor, action: SETTING_AUDIT, targetId: SETTING_TARGET[key] ?? null });
      });
    },
  };
}
