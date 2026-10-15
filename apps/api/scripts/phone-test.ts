// Dev-only: test login + cookie persistence from a phone on the same Wi-Fi.
//   bun run phone:test
// In-memory stores and the console mailer: no database, no real email. The 6-digit
// code is printed in THIS terminal. Never deploy this file.
import { Elysia } from "elysia";
import { createMemoryOtpStore } from "../src/auth/otp-memory-store";
import { createOtpService } from "../src/auth/otp-service";
import { authRoutes } from "../src/auth/routes";
import { createMemorySessionStore } from "../src/auth/session-memory-store";
import { createSessionService } from "../src/auth/session-service";
import { createConsoleMailer } from "../src/lib/mailer";

const port = Number(process.env.PORT ?? 3001);
const secure = process.env.HTTPS_TUNNEL === "1"; // set when you front this with an HTTPS tunnel

const { store, users } = createMemoryOtpStore();
const sessions = createMemorySessionStore(users);
const services = {
  otp: createOtpService({
    store,
    secret: "phone-test-secret-phone-test-secret-0",
    mailer: createConsoleMailer("KTRG <no-reply@localhost>"),
  }),
  session: createSessionService({ store: sessions.store }),
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
  pre { background: #f1f5f9; padding: 12px; border-radius: 8px; white-space: pre-wrap; word-break: break-all; }
</style></head><body>
<h2>Login test</h2>
<p id="mode"></p>
<input id="email" type="email" placeholder="email" value="me@example.com" autocapitalize="off">
<button onclick="send()">1. Send code (see PC terminal)</button>
<input id="code" inputmode="numeric" maxlength="6" placeholder="6-digit code">
<button onclick="verify()">2. Verify and log in</button>
<button class="alt" onclick="check()">Check session</button>
<button class="alt" onclick="logout()">Log out</button>
<pre id="out">Ready.</pre>
<script>
  const out = document.getElementById("out");
  document.getElementById("mode").textContent =
    (navigator.standalone ? "Mode: installed app (Home Screen)" : "Mode: Safari tab") +
    " | JS can see cookies: " + JSON.stringify(document.cookie);
  async function call(method, path, body) {
    const res = await fetch("/api/v1/auth/" + path, {
      method,
      headers: { "content-type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    out.textContent = method + " " + path + " -> " + res.status + "\\n" + (await res.text());
  }
  const email = () => document.getElementById("email").value;
  const send = () => call("POST", "otp/request", { email: email() });
  const verify = () => call("POST", "otp/verify", { email: email(), code: document.getElementById("code").value });
  const check = () => call("GET", "session");
  const logout = () => call("POST", "logout");
</script></body></html>`;

new Elysia()
  .get("/", ({ set }) => {
    set.headers["content-type"] = "text/html; charset=utf-8";
    return page;
  })
  .group("/api/v1", (g) => g.use(authRoutes(() => services, { secureCookies: secure })))
  .listen({ port, hostname: "0.0.0.0" });

console.log(`Phone test server on port ${port} (cookies ${secure ? "Secure/__Host-" : "plain http"}).`);
console.log("Open on the phone: http://<this PC's Wi-Fi IP>:" + port + "/");
console.log("Codes will be printed below.\n");
