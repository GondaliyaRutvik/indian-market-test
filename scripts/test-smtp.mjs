/**
 * Verifies Gmail (or any SMTP) credentials locally, without deploying.
 *
 *   node scripts/test-smtp.mjs                              # uses .env.local
 *   node scripts/test-smtp.mjs <user@gmail.com> <apppass>   # try a password directly
 *
 * The password never leaves your machine. Authentication is checked first with
 * transport.verify(), so a bad credential fails immediately rather than after a
 * send attempt.
 */
import { readFileSync } from "fs";
import nodemailer from "nodemailer";

function loadEnv() {
  for (const f of [".env.local", ".env"]) {
    try {
      for (const line of readFileSync(f, "utf8").split("\n")) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    } catch {
      /* absent is fine */
    }
  }
}
loadEnv();

const user = process.argv[2] || process.env.SMTP_USER || "";
const rawPass = process.argv[3] || process.env.SMTP_PASS || "";
const pass = rawPass.replace(/\s/g, ""); // Google shows it as 4 groups of 4
const to = process.env.EMAIL_TO || user;
const host = process.env.SMTP_HOST || "smtp.gmail.com";
const port = Number(process.env.SMTP_PORT || 587);

console.log("\nConfiguration");
console.log("  host  :", host, "port", port);
console.log("  user  :", user || "(missing)");
console.log("  pass  :", pass ? `${pass.length} chars` : "(missing)",
  rawPass !== pass ? "(spaces were stripped)" : "");
console.log("  to    :", to || "(missing)");

if (!user || !pass) {
  console.error("\nSMTP_USER and SMTP_PASS are required.");
  process.exit(1);
}
if (pass.length !== 16) {
  console.warn(`\n! A Gmail App Password is exactly 16 characters; this one is ${pass.length}.`);
}

const transport = nodemailer.createTransport({
  host,
  port,
  secure: port === 465,
  auth: { user, pass },
});

try {
  console.log("\nAuthenticating…");
  await transport.verify();
  console.log("  AUTH OK — the credentials are valid.");
} catch (err) {
  console.error("\n  AUTH FAILED:", err.message.split("\n")[0]);
  console.error(`
  For 535-5.7.8 BadCredentials, in order of likelihood:

    1. The App Password belongs to a DIFFERENT Google account.
       Open https://myaccount.google.com/apppasswords and check the account
       shown top-right is exactly:  ${user}

    2. 2-Step Verification was turned off after it was created.
       Disabling 2FA silently invalidates every App Password.

    3. It was revoked, or a character was mistyped.
       Generating a fresh one takes ten seconds.

  Your normal Gmail password will never work here — only an App Password.
`);
  process.exit(1);
}

console.log(`\nSending a test message to ${to}…`);
const info = await transport.sendMail({
  from: user,
  to,
  subject: "Market alerts — SMTP test",
  text: "If you are reading this, Gmail delivery works.",
  html: `<div style="font-family:system-ui,sans-serif;padding:20px">
           <h2 style="margin:0 0 8px">SMTP is working</h2>
           <p style="color:#374151">Sent from <b>${user}</b> to <b>${to}</b>.</p>
         </div>`,
});
console.log("  SENT. messageId:", info.messageId);
console.log("  accepted:", info.accepted.join(", "));
console.log("\nCopy this exact password into SMTP_PASS on Vercel, then redeploy.\n");
