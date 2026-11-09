import { Elysia } from "elysia";
import { createDrizzleAuditWriter } from "./audit/audit-store";
import { withWikimedia } from "./lib/https-url";
import { parseAdminEmails } from "./auth/admin-emails";
import { createDrizzleOtpStore } from "./auth/otp-store";
import { adminContentRoutes } from "./content/admin-routes";
import { createDrizzleContentStore } from "./content/content-store";
import { createDrizzleRallyAdminStore } from "./rallies/rally-admin-store";
import { rallyAdminRoutes } from "./rallies/rally-admin-routes";
import { guestRoutes } from "./guest/guest-routes";
import { rallyPublicRoutes } from "./rallies/rally-public-routes";
import { navigationRoutes } from "./navigation/navigation-routes";
import { gpxExportRoutes } from "./content/gpx-export";
import { stampAdminRoutes } from "./stamps/stamp-admin-routes";
import { stampRoutes } from "./stamps/stamp-routes";
import { createDrizzleStampListStore, stampList } from "./stamps/stamp-list";
import { createDrizzleStampStore } from "./stamps/stamp-store";
import { publicContentRoutes } from "./content/public-routes";
import { passkeyRoutes } from "./auth/passkey-routes";
import { passwordRoutes } from "./auth/password-routes";
import { createDrizzlePasswordStore } from "./auth/password-store";
import { createDrizzlePasskeyStore } from "./auth/passkey-store";
import { createDrizzleRateLimitStore } from "./auth/rate-limit-store";
import type { RouteOptions } from "./auth/route-kit";
import { authRoutes } from "./auth/routes";
import { createDrizzleSessionStore } from "./auth/session-store";
import { createDb } from "./db/client";
import { env } from "./env";
import { apiBase } from "./lib/api-errors";
import { createMailer } from "./lib/mailer";
import { ADMIN_LISTS } from "./admin-lists/lists";
import { listMetaRoutes, listReadRoutes, listWriteRoutes } from "./admin-lists/list-routes";
import { purgeRoutes } from "./internal/purge-routes";
import { auditLogList, createDrizzleAuditListStore } from "./audit/audit-list";
import { createDrizzleAuthorStore } from "./posts/author-store";
import { createDrizzleTagStore } from "./posts/tag-store";
import { tagList } from "./posts/tag-list";
import { authorList } from "./posts/author-list";
import { createDrizzleCommentStore } from "./posts/comment-store";
import { commentAdminRoutes, commentList, publicCommentRoutes } from "./posts/comments";
import { createDrizzleFuriganaStore } from "./furigana/furigana-store";
import { adminFuriganaRoutes, furiganaList, publicFuriganaRoutes } from "./furigana/furigana-words";
import { bannerList, bannerOrderRoutes, publicBannerRoutes } from "./banners/banner-list";
import { createDrizzleBannerStore } from "./banners/banner-store";
import { placeDirectoryList, placeImportRoutes, publicPlaceRoutes } from "./places/place-directory";
import { publicSettingsRoutes, siteSettingsRoutes } from "./site-settings/site-settings";
import { createDrizzleDashboardStore } from "./dashboard/dashboard-store";
import { dashboardRoutes } from "./dashboard/dashboard";
import { createDrizzleVisitStore } from "./visits/visit-store";
import { visitRoutes } from "./visits/visits";
import { createDrizzleSiteSettingsStore } from "./site-settings/site-settings-store";
import { createDrizzlePlaceStore } from "./places/place-store";
import { createDrizzlePlaceListStore, placeList } from "./content/place-list";
import { createDrizzleUserListStore, userList } from "./users/user-list";
import { userRoleRoutes } from "./users/user-routes";
import { noticeList, publicNoticeRoutes } from "./notices/notice-routes";
import { createDrizzleNoticeStore } from "./notices/notice-store";
import { postList, publicPostRoutes } from "./posts/post-list";
import { createDrizzlePostStore } from "./posts/post-store";
import { meRoutes } from "./me/me-routes";
import { createDrizzleMeStore } from "./me/me-store";
import { apiDocs } from "./openapi";
import { createRoutingService } from "./routing/routing-service";
import { createServices, type Services } from "./services";
import { subtitleRoutes, uploadRoutes } from "./uploads/upload-routes";
import { createR2Storage } from "./uploads/upload-storage";

// Built on first use, so importing the app never opens a database connection.
let services: Services | undefined;
function getServices(): Services {
  if (!services) {
    const { db } = createDb(env.DATABASE_URL);
    services = createServices({
      stores: {
        otp: createDrizzleOtpStore(db),
        session: createDrizzleSessionStore(db),
        rateLimit: createDrizzleRateLimitStore(db),
        passkeys: createDrizzlePasskeyStore(db),
        passwords: createDrizzlePasswordStore(db),
        me: createDrizzleMeStore(db),
        content: createDrizzleContentStore(db),
        rallyAdmin: createDrizzleRallyAdminStore(db),
        stamps: createDrizzleStampStore(db),
        stampList: createDrizzleStampListStore(db),
        notices: createDrizzleNoticeStore(db),
        posts: createDrizzlePostStore(db),
        banners: createDrizzleBannerStore(db),
        furigana: createDrizzleFuriganaStore(db),
        comments: createDrizzleCommentStore(db),
        authors: createDrizzleAuthorStore(db),
        tags: createDrizzleTagStore(db),
        places: createDrizzlePlaceStore(db),
        siteSettings: createDrizzleSiteSettingsStore(db),
        visits: createDrizzleVisitStore(db),
        dashboard: createDrizzleDashboardStore(db),
        auditList: createDrizzleAuditListStore(db),
        placeList: createDrizzlePlaceListStore(db),
        userList: createDrizzleUserListStore(db),
      },
      audit: createDrizzleAuditWriter(db),
      mailer: createMailer(env),
      routing: createRoutingService({ apiKey: env.ORS_API_KEY }),
      photoHosts: withWikimedia(env.PHOTO_HOSTS?.split(",").map((h) => h.trim().toLowerCase()).filter(Boolean) ?? []),
      publicRoutesTtlMs: env.NODE_ENV === "production" ? 10_000 : undefined,
      // Production requires the secret (parse-env); this dev fallback never ships.
      secret: env.OTP_HMAC_SECRET ?? "dev-only-otp-secret-change-me-0000000",
      adminEmails: parseAdminEmails(env.ADMIN_EMAILS).emails, // checked at boot (parse-env)
      passkey: {
        rpName: "葛城修験",
        // Passkeys only work on this domain, so it must be the site users actually visit.
        rpId: env.PASSKEY_RP_ID ?? new URL(env.APP_ORIGIN).hostname,
        origin: env.APP_ORIGIN,
      },
      // All five R2 settings or none (parse-env checks): without them uploads answer 503.
      uploads: env.R2_BUCKET_NAME
        ? {
            storage: createR2Storage({
              accountId: env.R2_ACCOUNT_ID!,
              accessKeyId: env.R2_ACCESS_KEY_ID!,
              secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
              bucket: env.R2_BUCKET_NAME,
            }),
            publicBaseUrl: env.R2_PUBLIC_URL!,
          }
        : undefined,
    });
  }
  return services;
}

/**
 * The whole API: every route file, mounted under /api/v1. The services come from outside, so
 * the tests and the dev page (scripts/phone-test.ts) run exactly this route tree on memory stores.
 */
export function createApp(
  getServices: () => Services,
  opts: RouteOptions & { docs: boolean; cronSecret?: string; appOrigin?: () => string },
) {
  return new Elysia({ prefix: "/api/v1" })
    .use(apiBase({ allowedOrigin: opts.appOrigin })) // first: request ids, the Origin check and the one error shape
    .use(apiDocs({ enabled: opts.docs }))
    .get(
      "/health",
      () => ({
        status: "ok" as const,
      }),
      { detail: { tags: ["Health"], summary: "Is the API up?" } },
    )
    .use(authRoutes(getServices, opts))
    .use(passkeyRoutes(getServices, opts))
    .use(passwordRoutes(getServices, opts))
    .use(meRoutes(getServices, opts))
    .use(adminContentRoutes(getServices, opts))
    .use(publicContentRoutes(() => getServices().content))
    .use(gpxExportRoutes(getServices, opts))
    .use(uploadRoutes(getServices, opts))
    .use(subtitleRoutes(getServices, opts))
    .use(rallyAdminRoutes(getServices, opts))
    .use(rallyPublicRoutes(getServices, env.NODE_ENV === "production" ? 10_000 : 0))
    .use(stampRoutes(getServices, opts))
    .use(guestRoutes(getServices, opts))
    .use(navigationRoutes(getServices, opts))
    .use(stampAdminRoutes(getServices, opts))
    .use(listReadRoutes(stampList, getServices, opts))
    // Admin lists (admin-lists/): each table described once, the same endpoints under /admin/lists/<key>.
    .use(listMetaRoutes(ADMIN_LISTS, getServices, opts))
    .use(listReadRoutes(noticeList, getServices, opts))
    .use(listWriteRoutes(noticeList, getServices, opts))
    .use(publicNoticeRoutes(() => getServices().notices))
    .use(listReadRoutes(postList, getServices, opts))
    .use(listWriteRoutes(postList, getServices, opts))
    .use(publicPostRoutes(() => getServices().posts))
    .use(listReadRoutes(bannerList, getServices, opts))
    .use(listWriteRoutes(bannerList, getServices, opts))
    .use(bannerOrderRoutes(getServices, opts))
    .use(publicBannerRoutes(() => getServices().banners))
    .use(listReadRoutes(furiganaList, getServices, opts))
    .use(listWriteRoutes(furiganaList, getServices, opts))
    .use(adminFuriganaRoutes(getServices, opts))
    .use(publicFuriganaRoutes(() => getServices().furigana))
    .use(listReadRoutes(authorList, getServices, opts))
    .use(listWriteRoutes(authorList, getServices, opts))
    .use(listReadRoutes(tagList, getServices, opts))
    .use(listWriteRoutes(tagList, getServices, opts))
    .use(listReadRoutes(commentList, getServices, opts))
    .use(commentAdminRoutes(getServices, opts))
    .use(publicCommentRoutes(getServices, opts))
    .use(listReadRoutes(placeDirectoryList, getServices, opts))
    .use(listWriteRoutes(placeDirectoryList, getServices, opts))
    .use(placeImportRoutes(getServices, opts))
    .use(publicPlaceRoutes(() => getServices().places))
    .use(visitRoutes(getServices, opts))
    .use(dashboardRoutes(getServices, opts))
    .use(siteSettingsRoutes(getServices, opts))
    .use(publicSettingsRoutes(() => getServices().siteSettings))
    .use(listReadRoutes(auditLogList, getServices, opts))
    .use(listReadRoutes(placeList, getServices, opts))
    .use(listReadRoutes(userList, getServices, opts))
    .use(userRoleRoutes(getServices, opts))
    .use(purgeRoutes(getServices, opts.cronSecret));
}

export const app = createApp(getServices, {
  secureCookies: env.NODE_ENV === "production",
  trustProxy: env.TRUST_PROXY,
  docs: env.NODE_ENV !== "production" || env.API_DOCS,
  cronSecret: env.CRON_SECRET,
  appOrigin: () => env.APP_ORIGIN,
});

// Vercel's entry: its Elysia preset picks the first of app.ts, index.ts, server.ts, src/app.ts,
// src/index.ts, src/server.ts that exists, and needs the app as the default export (no listen()).
// This file comes first, so it is the one. Importing ./env above still fails fast on a bad environment.
export default app;

export type App = typeof app;
/** The `{ ok: false, error }` body of every failure, for the web app's error handling. */
export type { ApiError, ErrorCode, ValidationIssue } from "./lib/api-errors";
/** How the admin screens draw each list (GET /admin/lists). */
export type { FieldUi, Label, ListMeta, Tone } from "./admin-lists/list-types";
