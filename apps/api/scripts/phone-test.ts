// Dev-only test page for login, cookies and passkeys.
//   bun run phone:test
// In-memory stores and the console mailer: no database, no real email. The 6-digit
// code is printed in THIS terminal. Never deploy this file.
//
// Passkeys only work on HTTPS or http://localhost. Open the page on this PC at
// http://localhost:3001/ (Windows Hello), or on a phone through any HTTPS forwarded address
// (VS Code port forwarding with Public visibility, cloudflared, ngrok). No setup needed:
// the page tells the server which address it is on.
import { appendFileSync } from "node:fs";
import { Elysia } from "elysia";
import { createApp } from "../src/app";
import { auditRow } from "../src/audit/audit-log";
import { createMemoryOtpStore } from "../src/auth/otp-memory-store";
import { createMemoryPasskeyStore } from "../src/auth/passkey-memory-store";
import { createMemoryRateLimitStore } from "../src/auth/rate-limit-memory-store";
import { createMemorySessionStore } from "../src/auth/session-memory-store";
import { createConsoleMailer } from "../src/lib/mailer";
import { createMemoryMeStore } from "../src/me/me-memory-store";
import { createMemoryContentStore } from "../src/content/content-memory-store";
import { createMemoryRallyAdminStore } from "../src/rallies/rally-admin-memory-store";
import { createMemoryStampStore } from "../src/stamps/stamp-memory-store";
import { createMemoryNoticeStore } from "../src/notices/notice-memory-store";
import { createMemoryPlaceStore } from "../src/places/place-directory";
import { createMemoryBannerStore } from "../src/banners/banner-list";
import { memoryReader } from "../src/admin-lists/list-memory-store";
import { createMemoryUserListStore } from "../src/users/user-list";
import { createServices } from "../src/services";

const port = Number(process.env.PORT ?? 3001);
const secure = process.env.HTTPS_TUNNEL === "1"; // set when you front this with an HTTPS tunnel
// Passkeys are tied to the exact address they are made on. For this dev tool the page tells
// the server which address it is open on (x-test-origin), so a forwarded address, a tunnel or
// localhost all just work. A real deployment uses a fixed APP_ORIGIN instead.
const current = { origin: process.env.PASSKEY_ORIGIN ?? `http://localhost:${port}` };
const passkeyConfig = {
  rpName: "KTRG test",
  get origin() {
    return current.origin;
  },
  get rpId() {
    return new URL(current.origin).hostname;
  },
};

const profiles = new Map<string, { displayName: string | null; origin: string | null }>();
// Browser tests (not a person) can set MAIL_LOG to a file: every mail body is also appended there,
// because stdout redirected to a file is buffered and the code would not show up in time.
function withMailFile<T extends { send(message: { text: string }): Promise<unknown> }>(mailer: T): T {
  const file = process.env.MAIL_LOG;
  if (!file) return mailer;
  return {
    ...mailer,
    async send(message: { text: string }) {
      appendFileSync(file, `${message.text}\n----\n`);
      return mailer.send(message);
    },
  };
}

const { store, users } = createMemoryOtpStore(profiles);
// Audit entries are checked like the real writer and printed in this terminal.
const audit = {
  async record(entry: Parameters<typeof auditRow>[0]) {
    const row = auditRow(entry);
    console.log(`[audit] ${row.action} actor=${row.actorUserId} ${row.targetType}=${row.targetId}`);
  },
};
const stampMem = createMemoryStampStore(audit);
// Same wiring as the app (src/services.ts), with in-memory stores and the console mailer.
const services = createServices({
  stores: {
    otp: store,
    session: createMemorySessionStore(users).store,
    rateLimit: createMemoryRateLimitStore().store,
    passkeys: createMemoryPasskeyStore(users, profiles).store,
    me: createMemoryMeStore(users, profiles).store,
    content: createMemoryContentStore(audit).store,
    rallyAdmin: createMemoryRallyAdminStore(audit).store,
    stamps: stampMem.store,
    stampList: stampMem.listStore,
    notices: createMemoryNoticeStore(audit).store,
    banners: createMemoryBannerStore(audit).store,
    places: createMemoryPlaceStore(audit).store,
    auditList: memoryReader(new Map()),
    placeList: memoryReader(new Map()),
    userList: createMemoryUserListStore(audit).store,
  },
  audit,
  // This address becomes an admin on an email-code login, so the admin screens can be tried (this page only).
  adminEmails: new Set(["admin@example.com"]),
  // Codes and alert emails are printed in this terminal.
  mailer: withMailFile(createConsoleMailer("KTRG <no-reply@localhost>")),
  secret: "phone-test-secret-phone-test-secret-0",
  passkey: passkeyConfig,
  // A pretend route-finder, so the admin's "snap to trails" can be tried here without a key: it joins the points with a
  // gentle sideways wobble and heights that rise and fall (this page only; the real one is src/routing).
  routing: {
    async snap(points) {
      const line: [number, number, number][] = [];
      points.forEach((p, i) => {
        const next = points[i + 1];
        if (!next) return line.push([p.lng, p.lat, 100]);
        for (let k = 0; k < 10; k++) {
          const f = k / 10;
          line.push([p.lng + (next.lng - p.lng) * f + Math.sin((f + i) * 6) * 0.0004, p.lat + (next.lat - p.lat) * f, 100 + Math.round(Math.sin(f * 3 + i) * 40)]);
        }
      });
      return { ok: true, line, distanceM: line.length * 50 };
    },
  },
});

const page = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="KTRG test">
<title>KTRG login test</title>
<style>
  body { font: 18px/1.4 system-ui, sans-serif; margin: 16px; max-width: 480px; }
  input, button { font: inherit; padding: 12px; width: 100%; box-sizing: border-box; margin: 6px 0; }
  button { background: #1d4ed8; color: #fff; border: 0; border-radius: 8px; }
  button.alt { background: #475569; }
  button.pk { background: #047857; }
  pre { background: #f1f5f9; padding: 12px; border-radius: 8px; white-space: pre-wrap; word-break: break-all; }
  .warn { color: #b91c1c; }
  h3 { margin-bottom: 0; }
</style></head><body>
<h2>Login test</h2>
<p id="mode"></p>

<h3>Passkey (no email)</h3>
<button class="pk" onclick="pkSignup()">Sign up with a passkey</button>
<button class="pk" onclick="pkLogin()">Log in with a passkey</button>

<h3>Email code</h3>
<input id="email" type="email" placeholder="email" value="me@example.com" autocapitalize="off">
<button onclick="send()">1. Send code (see PC terminal)</button>
<input id="code" inputmode="numeric" maxlength="6" placeholder="6-digit code">
<button onclick="verify()">2. Verify and log in</button>

<h3>My passkeys (log in first)</h3>
<input id="pkname" placeholder="name for the new passkey" value="test device">
<button class="pk" onclick="pkAdd()">Add a passkey to this account</button>
<button class="alt" onclick="pkList()">List my passkeys</button>
<div id="pklist"></div>

<h3>Session</h3>
<button class="alt" onclick="check()">Check session</button>
<button class="alt" onclick="logout()">Log out</button>
<pre id="out">Ready.</pre>
<script>
  const out = document.getElementById("out");
  document.getElementById("mode").innerHTML =
    (navigator.standalone ? "Mode: installed app" : "Mode: browser tab") +
    "<br>Address: " + location.origin +
    "<br>Secure context (passkeys allowed): " + window.isSecureContext +
    (window.isSecureContext ? "" : '<br><span class="warn">Passkeys need HTTPS or localhost. Use the https:// forwarded address.</span>') +
    "<br>JS can see cookies: " + JSON.stringify(document.cookie);

  async function call(method, path, body) {
    const res = await fetch("/api/v1/auth/" + path, {
      method,
      // x-test-origin: dev only, tells the server which address this page is on (passkeys are per address).
      headers: { "content-type": "application/json", "x-test-origin": location.origin },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    out.textContent = method + " " + path + " -> " + res.status + "\\n" + text;
    try { return JSON.parse(text); } catch { return null; }
  }
  const email = () => document.getElementById("email").value;
  const send = () => call("POST", "otp/request", { email: email() });
  const verify = () => call("POST", "otp/verify", { email: email(), code: document.getElementById("code").value });
  const check = () => call("GET", "session");
  const logout = () => call("POST", "logout");

  // base64url <-> bytes, as WebAuthn needs
  const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\\+/g, "-").replace(/\\//g, "_").replace(/=+$/, "");
  const unb64 = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

  async function pkSignup() {
    try {
      const o = (await call("POST", "passkeys/signup/options")).options;
      out.textContent += "\\n\\nWaiting for the passkey prompt...";
      const cred = await navigator.credentials.create({
        publicKey: { ...o, challenge: unb64(o.challenge), user: { ...o.user, id: unb64(o.user.id) } },
      });
      const r = cred.response;
      await call("POST", "passkeys/signup/verify", {
        label: "test device",
        response: {
          id: cred.id, rawId: b64(cred.rawId), type: cred.type,
          response: {
            clientDataJSON: b64(r.clientDataJSON),
            attestationObject: b64(r.attestationObject),
            transports: r.getTransports ? r.getTransports() : [],
          },
          clientExtensionResults: cred.getClientExtensionResults(),
          ...(cred.authenticatorAttachment ? { authenticatorAttachment: cred.authenticatorAttachment } : {}),
        },
      });
    } catch (e) { out.textContent += "\\n\\nERROR: " + e.name + ": " + e.message; }
  }

  // Add another passkey to the account you are logged into (an alert email prints in the PC terminal).
  async function pkAdd() {
    try {
      const o = (await call("POST", "passkeys/register/options")).options;
      if (!o) return;
      out.textContent += "\\n\\nWaiting for the passkey prompt...";
      const cred = await navigator.credentials.create({
        publicKey: {
          ...o,
          challenge: unb64(o.challenge),
          user: { ...o.user, id: unb64(o.user.id) },
          excludeCredentials: (o.excludeCredentials || []).map((c) => ({ ...c, id: unb64(c.id) })),
        },
      });
      const r = cred.response;
      await call("POST", "passkeys/register/verify", {
        label: document.getElementById("pkname").value,
        response: {
          id: cred.id, rawId: b64(cred.rawId), type: cred.type,
          response: {
            clientDataJSON: b64(r.clientDataJSON),
            attestationObject: b64(r.attestationObject),
            transports: r.getTransports ? r.getTransports() : [],
          },
          clientExtensionResults: cred.getClientExtensionResults(),
          ...(cred.authenticatorAttachment ? { authenticatorAttachment: cred.authenticatorAttachment } : {}),
        },
      });
      await pkList();
    } catch (e) { out.textContent += "\\n\\nERROR: " + e.name + ": " + e.message; }
  }

  async function pkList() {
    const body = await call("GET", "passkeys");
    const box = document.getElementById("pklist");
    box.textContent = "";
    for (const p of (body && body.passkeys) || []) {
      const row = document.createElement("div");
      const text = document.createElement("div");
      text.textContent = (p.label || "(no name)") + " - added " + new Date(p.createdAt).toLocaleString();
      const btn = document.createElement("button");
      btn.className = "alt";
      btn.textContent = "Remove this passkey";
      btn.onclick = async () => {
        await call("DELETE", "passkeys/" + p.id);
        const result = out.textContent; // keep the answer (e.g. a refusal) visible after refreshing the list
        await pkList();
        out.textContent = result + "\\n\\n(list refreshed)";
      };
      row.append(text, btn);
      box.append(row);
    }
    if (body && body.ok && !box.children.length) box.textContent = "No passkeys.";
  }

  async function pkLogin() {
    try {
      const o = (await call("POST", "passkeys/login/options")).options;
      out.textContent += "\\n\\nWaiting for the passkey prompt...";
      const cred = await navigator.credentials.get({ publicKey: { ...o, challenge: unb64(o.challenge) } });
      const r = cred.response;
      await call("POST", "passkeys/login/verify", {
        response: {
          id: cred.id, rawId: b64(cred.rawId), type: cred.type,
          response: {
            clientDataJSON: b64(r.clientDataJSON),
            authenticatorData: b64(r.authenticatorData),
            signature: b64(r.signature),
            ...(r.userHandle ? { userHandle: b64(r.userHandle) } : {}),
          },
          clientExtensionResults: cred.getClientExtensionResults(),
          ...(cred.authenticatorAttachment ? { authenticatorAttachment: cred.authenticatorAttachment } : {}),
        },
      });
    } catch (e) { out.textContent += "\\n\\nERROR: " + e.name + ": " + e.message; }
  }
</script></body></html>`;

const routeOpts = { secureCookies: secure };

new Elysia()
  .onRequest(({ request }) => {
    const claimed = request.headers.get("x-test-origin");
    if (claimed && /^https?:\/\/[^/\s]+$/.test(claimed) && claimed !== current.origin) {
      current.origin = claimed;
      console.log(`Passkey site is now ${claimed} (RP ID ${passkeyConfig.rpId})`);
    }
  })
  .get("/", ({ set }) => {
    set.headers["content-type"] = "text/html; charset=utf-8";
    return page;
  })
  // The app's own route tree (with /api/v1/openapi docs), on the in-memory services.
  .use(createApp(() => services, { ...routeOpts, docs: true, appOrigin: () => current.origin }))
  .listen({ port, hostname: "0.0.0.0" });

console.log(`Test server on port ${port} (cookies ${secure ? "Secure/__Host-" : "plain http"}).`);
console.log("Passkeys follow whichever address the page is opened on (localhost, a forwarded address, a tunnel).");
console.log("A passkey made on one address does not work on another. Passkeys need HTTPS or localhost.");
console.log("Email codes will be printed below.\n");
