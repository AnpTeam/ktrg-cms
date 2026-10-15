// Dev-only test page for login, cookies and passkeys.
//   bun run phone:test
// In-memory stores and the console mailer: no database, no real email. The 6-digit
// code is printed in THIS terminal. Never deploy this file.
//
// Passkeys only work on HTTPS or http://localhost, and the address you open must match
// PASSKEY_ORIGIN. On this PC:   open http://localhost:3001/   (Windows Hello)
// On a phone: run an HTTPS tunnel to this port, then
//   PASSKEY_ORIGIN=https://<tunnel-host> HTTPS_TUNNEL=1 bun run phone:test
import { Elysia } from "elysia";
import { createMemoryOtpStore } from "../src/auth/otp-memory-store";
import { createOtpService } from "../src/auth/otp-service";
import { createMemoryPasskeyStore } from "../src/auth/passkey-memory-store";
import { passkeyRoutes } from "../src/auth/passkey-routes";
import { createPasskeyService } from "../src/auth/passkey-service";
import { createRateLimiter } from "../src/auth/rate-limit";
import { createMemoryRateLimitStore } from "../src/auth/rate-limit-memory-store";
import { authRoutes } from "../src/auth/routes";
import { createMemorySessionStore } from "../src/auth/session-memory-store";
import { createSessionService } from "../src/auth/session-service";
import { createConsoleMailer } from "../src/lib/mailer";

const port = Number(process.env.PORT ?? 3001);
const secure = process.env.HTTPS_TUNNEL === "1"; // set when you front this with an HTTPS tunnel
const origin = process.env.PASSKEY_ORIGIN ?? `http://localhost:${port}`;
const rpId = new URL(origin).hostname;

const { store, users } = createMemoryOtpStore();
const sessions = createMemorySessionStore(users);
const secret = "phone-test-secret-phone-test-secret-0";
const services = {
  otp: createOtpService({ store, secret, mailer: createConsoleMailer("KTRG <no-reply@localhost>") }),
  session: createSessionService({ store: sessions.store }),
  rateLimit: createRateLimiter({ store: createMemoryRateLimitStore().store, secret }),
  passkeys: createPasskeyService({
    store: createMemoryPasskeyStore(users).store,
    config: { rpName: "KTRG test", rpId, origin },
  }),
};

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

<h3>Session</h3>
<button class="alt" onclick="check()">Check session</button>
<button class="alt" onclick="logout()">Log out</button>
<pre id="out">Ready.</pre>
<script>
  const out = document.getElementById("out");
  const EXPECTED = ${JSON.stringify(origin)};
  document.getElementById("mode").innerHTML =
    (navigator.standalone ? "Mode: installed app" : "Mode: browser tab") +
    " | JS can see cookies: " + JSON.stringify(document.cookie) +
    (location.origin === EXPECTED ? "" : '<br><span class="warn">You are on ' + location.origin +
      " but passkeys are set up for " + EXPECTED + ". Passkeys will fail until you open that address.</span>");

  async function call(method, path, body) {
    const res = await fetch("/api/v1/auth/" + path, {
      method,
      headers: { "content-type": "application/json" },
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
  .get("/", ({ set }) => {
    set.headers["content-type"] = "text/html; charset=utf-8";
    return page;
  })
  .group("/api/v1", (g) => g.use(authRoutes(() => services, routeOpts)).use(passkeyRoutes(() => services, routeOpts)))
  .listen({ port, hostname: "0.0.0.0" });

console.log(`Test server on port ${port} (cookies ${secure ? "Secure/__Host-" : "plain http"}).`);
console.log(`Passkeys are set up for ${origin} (RP ID ${rpId}). Open exactly that address.`);
console.log("Email codes will be printed below.\n");
