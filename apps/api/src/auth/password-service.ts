import { buildPasswordAlertEmail, type PasswordAlertAction } from "../emails/password-alert";
import { mailFailure, type Mailer } from "../lib/mailer";
import { normalizeEmail } from "./otp";
import { generateUndoToken, hashPassword, hashUndoToken, passwordProblem, SCRYPT_COST, verifyPassword } from "./password";
import { can } from "./permissions";
import type { AuthUser } from "./user";

/** How long the "this was not me" link in the email works. */
export const UNDO_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Storage the service needs; the Drizzle version is in password-store.ts. */
export interface PasswordStore {
  /** The account with this email and its password hash (null when it has none), or null when there is no such account. */
  findLogin(email: string): Promise<{ user: AuthUser; hash: string | null } | null>;
  hasPassword(userId: string): Promise<boolean>;
  /** Set or replace the password, keep the undo token and write the audit row, together. True when one was replaced. */
  save(userId: string, hash: string, undo: { tokenHash: string; expiresAt: Date }, now: Date): Promise<boolean>;
  /** Remove the password and write the audit row. False when there was none. Undo links stay: they also sign everyone out. */
  remove(userId: string): Promise<boolean>;
  /** Use an undo link: remove the password, void every link of the account, write the audit row. The user id, or null. */
  undo(tokenHash: string, now: Date): Promise<string | null>;
}

export type SetResult = "ok" | "no_email" | "too_short" | "too_common";

/**
 * The optional password. Another way in beside the emailed number and the passkey, never the only one: it needs an email
 * on the account, and that mailbox is how a forgotten password is replaced (log in with the number, set a new one).
 * Staff accounts cannot use it (`me.password`): an admin takeover is the worst case, and a password is what gets phished.
 */
export function createPasswordService({
  store,
  mailer,
  appOrigin,
  now = () => new Date(),
  cost = SCRYPT_COST,
  log = console.error,
}: {
  store: PasswordStore;
  mailer?: Mailer;
  appOrigin: string;
  now?: () => Date;
  /** Tests lower this; the real cost takes a noticeable moment on purpose. */
  cost?: number;
  log?: (message: string) => void;
}) {
  // Checked when there is nothing to check against, so an unknown address takes as long as a wrong password.
  let decoy: Promise<string> | undefined;

  async function alert(user: AuthUser, action: PasswordAlertAction, undoUrl?: string) {
    if (!mailer || !user.email) return;
    try {
      await mailer.send(buildPasswordAlertEmail({ to: user.email, locale: user.locale, action, at: now(), undoUrl }));
    } catch (err) {
      log(`password alert: ${mailFailure(err)}`);
    }
  }

  return {
    /** The account, or null for every kind of failure, so nothing can be probed. */
    async login(email: string, password: string): Promise<AuthUser | null> {
      const found = await store.findLogin(normalizeEmail(email));
      const hash = found && can(found.user.role, "me.password") ? found.hash : null;
      decoy ??= hashPassword("decoy", cost);
      const good = await verifyPassword(password, hash ?? (await decoy));
      return hash && good ? found!.user : null;
    },

    hasPassword: (user: AuthUser) => store.hasPassword(user.id),

    async set(user: AuthUser, password: string): Promise<SetResult> {
      if (!user.email) return "no_email";
      const problem = passwordProblem(password, user.email);
      if (problem) return problem;
      const token = generateUndoToken();
      const at = now();
      const undo = { tokenHash: hashUndoToken(token), expiresAt: new Date(at.getTime() + UNDO_TTL_MS) };
      const replaced = await store.save(user.id, await hashPassword(password, cost), undo, at);
      // In the fragment, so the token stays out of server and proxy logs.
      await alert(user, replaced ? "changed" : "set", `${appOrigin}/password/undo#${token}`);
      return "ok";
    },

    async remove(user: AuthUser): Promise<boolean> {
      const removed = await store.remove(user.id);
      if (removed) await alert(user, "removed");
      return removed;
    },

    /** The owner said "this was not me". Returns whose password went, so the caller can end their sessions. */
    undo: (token: string) => store.undo(hashUndoToken(token), now()),
  };
}

export type PasswordService = ReturnType<typeof createPasswordService>;
