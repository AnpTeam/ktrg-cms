import { t } from "elysia";
import { userLocale } from "../db/schema";

/** Request-body pieces shared by several routes, so each rule lives in one place. */

/** An email address, as long as an address can be. */
export const emailSchema = t.String({ format: "email", maxLength: 254 });

/** A 6-digit one-time code (login or fresh-login re-check). */
export const otpCodeSchema = t.String({ pattern: "^[0-9]{6}$" });

/**
 * "ja" or "en": the user_locale values in the database. Built from literals on purpose:
 * t.UnionEnum lets an unknown value such as "fr" through when the field is optional.
 */
export const localeSchema = t.Union(userLocale.enumValues.map((value) => t.Literal(value)));

/** A `:id` path parameter that must be a UUID. */
export const uuidParams = t.Object({ id: t.String({ pattern: "^[0-9a-fA-F-]{36}$" }) });
