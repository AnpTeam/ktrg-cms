import { desc, eq } from "drizzle-orm";
import type { Db } from "../db/client";
import { otpCodes } from "../db/schema";
import type { OtpStore } from "./otp-service";

export function createDrizzleOtpStore(db: Db): OtpStore {
  return {
    async latestExpiry(email) {
      const [row] = await db
        .select({ expiresAt: otpCodes.expiresAt })
        .from(otpCodes)
        .where(eq(otpCodes.email, email))
        .orderBy(desc(otpCodes.expiresAt))
        .limit(1);
      return row?.expiresAt ?? null;
    },
    async insert(row) {
      await db.insert(otpCodes).values(row);
    },
  };
}
