import type { AuditWriter } from "./audit/audit-log";
import { createOtpService, type OtpStore } from "./auth/otp-service";
import { createPasskeyService, type PasskeyConfig, type PasskeyStore } from "./auth/passkey-service";
import type { PasskeyServices } from "./auth/passkey-routes";
import { AUTH_LIMITS, createRateLimiter, type RateLimitStore } from "./auth/rate-limit";
import type { NavigationServices } from "./navigation/navigation-routes";
import type { AuthServices } from "./auth/routes";
import { createSessionService, type SessionStore } from "./auth/session-service";
import type { Mailer } from "./lib/mailer";
import type { MeServices } from "./me/me-routes";
import { createListReader } from "./admin-lists/list-service";
import type { ListReadStore } from "./admin-lists/list-types";
import type { AuditListRow, AuditListServices } from "./audit/audit-list";
import { createSitePageService, type SitePageServices, type SitePageStore } from "./pages/site-pages";
import { createFuriganaService, type FuriganaServices, type FuriganaStore } from "./furigana/furigana-words";
import { createBannerService, type BannerServices, type BannerStore } from "./banners/banner-list";
import type { PlaceListRow, PlaceListServices } from "./content/place-list";
import { createPlaceService, type PlaceServices, type PlaceStore } from "./places/place-directory";
import { createVisitService, type VisitServices, type VisitStore } from "./visits/visits";
import { createSiteSettingsService, type SiteSettingsServices, type SiteSettingsStore } from "./site-settings/site-settings";
import { createUserListService, type UserListServices, type UserListStore } from "./users/user-list";
import type { NoticeServices } from "./notices/notice-routes";
import { createNoticeService } from "./notices/notice-service";
import type { NoticeStore } from "./notices/notice-types";
import { createAuthorService, type AuthorServices, type AuthorStore } from "./posts/author-list";
import { createCommentService, type CommentServices, type CommentStore } from "./posts/comments";
import { createPostService, type PostServices, type PostStore } from "./posts/post-list";
import type { ContentServices } from "./content/admin-routes";
import { createContentService } from "./content/content-service";
import { createRoutingService, withDailyCap, type RoutingService } from "./routing/routing-service";
import type { ContentStore } from "./content/content-types";
import type { RallyAdminServices } from "./rallies/rally-admin-routes";
import { createRallyAdminService } from "./rallies/rally-admin-service";
import type { RallyAdminStore } from "./rallies/rally-admin-types";
import type { StampListServices } from "./stamps/stamp-list";
import type { StampServices } from "./stamps/stamp-routes";
import { createStampService } from "./stamps/stamp-service";
import type { GuestServices } from "./guest/guest-routes";
import { createGuestService } from "./guest/guest-service";
import type { StampListRow, StampStore } from "./stamps/stamp-types";
import { createMeService, type MeStore } from "./me/me-service";
import type { UploadServices } from "./uploads/upload-routes";
import { createUploadService } from "./uploads/upload-service";
import type { FileStorage } from "./uploads/upload-storage";

/** Everything the routes use. */
export type Services = AuthServices & PasskeyServices & MeServices & ContentServices & UploadServices & RallyAdminServices & StampServices & StampListServices & NoticeServices & PostServices & CommentServices & AuthorServices & BannerServices & PlaceServices & SiteSettingsServices & VisitServices & AuditListServices & PlaceListServices & UserListServices & GuestServices & FuriganaServices & SitePageServices & NavigationServices;

/** What the services are built from: the storage (database or in-memory) and the outside world. */
export interface ServiceDeps {
  stores: {
    otp: OtpStore;
    session: SessionStore;
    rateLimit: RateLimitStore;
    passkeys: PasskeyStore;
    me: MeStore;
    content: ContentStore;
    rallyAdmin: RallyAdminStore;
    stamps: StampStore;
    stampList: ListReadStore<StampListRow>;
    notices: NoticeStore;
    posts: PostStore;
    banners: BannerStore;
    furigana: FuriganaStore;
    sitePages: SitePageStore;
    comments: CommentStore;
    authors: AuthorStore;
    places: PlaceStore;
    siteSettings: SiteSettingsStore;
    visits: VisitStore;
    auditList: ListReadStore<AuditListRow>;
    placeList: ListReadStore<PlaceListRow>;
    userList: UserListStore;
  };
  audit: AuditWriter;
  /** Sends login codes and the passkey / deletion alerts. */
  mailer: Mailer;
  /** Key for hashing login codes and rate-limit identifiers. */
  secret: string;
  /** ADMIN_EMAILS, normalized: promoted to admin on an email-code login. */
  adminEmails?: ReadonlySet<string>;
  passkey: PasskeyConfig;
  /** Photo storage (Cloudflare R2) and its public address. Without them uploads answer 503. */
  uploads?: { storage: FileStorage; publicBaseUrl: string };
  /** Host names a photo address may use (PHOTO_HOSTS). Empty or missing: any https address. */
  photoHosts?: readonly string[];
  /** How long the public route list may be reused (ms); unset: never. */
  publicRoutesTtlMs?: number;
  /** Snaps a drawn line to trails. Without one, the admin is told the service is not set up. */
  routing?: RoutingService;
  /** The clock every service reads. Tests move it; the app uses real time. */
  now?: () => Date;
}

/**
 * Wire the services together. The app passes the Drizzle stores (app.ts); the dev page
 * passes in-memory ones (scripts/phone-test.ts). Same wiring, so both behave the same.
 */
export function createServices(deps: ServiceDeps): Services {
  const { stores, mailer, secret, now } = deps;
  const rateLimit = createRateLimiter({ store: stores.rateLimit, secret, now });
  const stamps = createStampService({ store: stores.stamps });
  const posts = createPostService({ store: stores.posts, photoHosts: deps.photoHosts, now, placeExists: async (id) => (await stores.places.get(id)) !== null, routeExists: async (id) => (await stores.content.getRoute(id)) !== null, spotExists: async (id) => (await stores.content.getSpot(id)) !== null, authorExists: async (id) => (await stores.authors.get(id)) !== null });
  const routing = withDailyCap(deps.routing ?? createRoutingService({}), rateLimit);
  return {
    otp: createOtpService({ store: stores.otp, mailer, secret, adminEmails: deps.adminEmails, now }),
    session: createSessionService({ store: stores.session, now }),
    rateLimit,
    audit: deps.audit,
    // Emails the owner when a passkey is added or removed.
    passkeys: createPasskeyService({ store: stores.passkeys, mailer, config: deps.passkey, now }),
    // Profile, language, display name and deletion requests (emails the owner).
    me: createMeService({ store: stores.me, mailer, now, photoHosts: deps.photoHosts }),
    // Routes and places: what the admin edits and visitors read.
    content: createContentService({ store: stores.content, photoHosts: deps.photoHosts, publicRoutesTtlMs: deps.publicRoutesTtlMs }),
    // Rallies: names, dates, required count and which places they hold.
    rallyAdmin: createRallyAdminService({ store: stores.rallyAdmin }),
    // Collecting stamps near a place, reading your own, and the admin review of flagged ones.
    stamps,
    stampList: createListReader({ store: stores.stampList }),
    // Stamps without an account (a signed cookie), and moving them to an account at sign-up.
    guest: createGuestService({ stamps, secret, now }),
    // Trail notices: the admin list and what visitors read.
    notices: createNoticeService({ store: stores.notices, now }),
    // Blog posts: the admin list and what visitors read.
    posts,
    // The other generated admin lists: home banners, the audit log, every place, accounts and their roles.
    banners: createBannerService({ store: stores.banners, photoHosts: deps.photoHosts }),
    furigana: createFuriganaService({ store: stores.furigana }),
    sitePages: createSitePageService({ store: stores.sitePages }),
    authors: createAuthorService({ store: stores.authors, photoHosts: deps.photoHosts }),
    comments: createCommentService({ store: stores.comments, postVisible: async (id) => (await posts.publicPost(id)) !== null }),
    places: createPlaceService({ store: stores.places, photoHosts: deps.photoHosts, routeExists: async (id) => (await stores.content.getRoute(id)) !== null, spotExists: async (id) => (await stores.content.getSpot(id)) !== null, routeSpots: async (id) => (await stores.content.getRoute(id))?.spots ?? [], routeIds: async () => (await stores.content.listRoutes()).map((r) => r.id) }),
    siteSettings: createSiteSettingsService({ store: stores.siteSettings }),
    visits: createVisitService({ store: stores.visits, now }),
    auditList: createListReader({ store: stores.auditList }),
    placeList: createListReader({ store: stores.placeList }),
    userList: createUserListService({ store: stores.userList }),
    // Admin photo uploads.
    uploads: createUploadService({ ...deps.uploads }),
    // The route-finding service behind the map editor's "snap to trails" (no key: it answers "not set up").
    routing,
    // Visitors' navigation: the same service, held to its own share of the day so the admin's snap always keeps some.
    navigationRouting: withDailyCap(routing, rateLimit, AUTH_LIMITS.navigationAllDaily),
  };
}
