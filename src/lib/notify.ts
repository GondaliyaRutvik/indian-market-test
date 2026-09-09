import type { Setting } from "@prisma/client";

export type Channel = "telegram" | "email" | "inapp";

export type DeliveryResult = { ok: boolean; detail: string };

/** DB setting wins; env var is the fallback. Blank strings count as unset. */
function pick(dbValue: string | null | undefined, envValue: string | undefined): string {
  const v = (dbValue ?? "").trim();
  return v || (envValue ?? "").trim();
}

export function telegramConfig(settings: Setting) {
  return {
    token: pick(settings.telegramBotToken, process.env.TELEGRAM_BOT_TOKEN),
    chatId: pick(settings.telegramChatId, process.env.TELEGRAM_CHAT_ID),
  };
}

export function emailConfig(settings: Setting) {
  return {
    to: pick(settings.emailTo, process.env.EMAIL_TO),
    resendKey: (process.env.RESEND_API_KEY ?? "").trim(),
    // Left empty when unset so each transport can pick its own correct default:
    // Resend needs a verified domain (or its sandbox address), while SMTP must
    // send as the authenticating mailbox or the provider rejects the sender.
    from: (process.env.EMAIL_FROM ?? "").trim(),
    smtpHost: (process.env.SMTP_HOST ?? "").trim(),
    smtpPort: Number(process.env.SMTP_PORT ?? 587),
    // EMAIL_USER/EMAIL_PASS accepted as aliases — both namings are in common use
    // and silently reading neither is a confusing failure.
    smtpUser: (process.env.SMTP_USER ?? process.env.EMAIL_USER ?? "").trim(),
    // Google presents App Passwords as four space-separated groups. Pasting them
    // verbatim is the norm, so strip internal whitespace rather than handing
    // Gmail a 19-character string and reporting "bad credentials".
    smtpPass: (process.env.SMTP_PASS ?? process.env.EMAIL_PASS ?? "").replace(/\s+/g, ""),
  };
}

// ---------------------------------------------------------------------------
// Telegram
// ---------------------------------------------------------------------------

export async function sendTelegram(
  settings: Setting,
  text: string,
): Promise<DeliveryResult> {
  const { token, chatId } = telegramConfig(settings);
  if (!token || !chatId) {
    return { ok: false, detail: "Telegram not configured (missing bot token or chat id)" };
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json?.ok === false) {
      return { ok: false, detail: `Telegram error: ${json?.description ?? res.status}` };
    }
    return { ok: true, detail: "Telegram delivered" };
  } catch (err) {
    return { ok: false, detail: `Telegram failed: ${err instanceof Error ? err.message : err}` };
  }
}

// ---------------------------------------------------------------------------
// Email — Resend HTTP API if a key is present, otherwise SMTP via nodemailer
// ---------------------------------------------------------------------------

export async function sendEmail(
  settings: Setting,
  subject: string,
  html: string,
  textBody: string,
): Promise<DeliveryResult> {
  const cfg = emailConfig(settings);
  if (!cfg.to) return { ok: false, detail: "Email not configured (no recipient address)" };

  if (cfg.resendKey) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cfg.resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: cfg.from || "Nifty Alerts <onboarding@resend.dev>",
          to: [cfg.to],
          subject,
          html,
          text: textBody,
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        return { ok: false, detail: `Resend error ${res.status}: ${body.slice(0, 200)}` };
      }
      return { ok: true, detail: `Email sent to ${cfg.to} via Resend` };
    } catch (err) {
      return { ok: false, detail: `Resend failed: ${err instanceof Error ? err.message : err}` };
    }
  }

  if (cfg.smtpHost && cfg.smtpUser && cfg.smtpPass) {
    try {
      const nodemailer = await import("nodemailer");
      const transport = nodemailer.default.createTransport({
        host: cfg.smtpHost,
        port: cfg.smtpPort,
        secure: cfg.smtpPort === 465,
        auth: { user: cfg.smtpUser, pass: cfg.smtpPass },
      });
      await transport.sendMail({
        from: cfg.from || cfg.smtpUser,
        to: cfg.to,
        subject,
        html,
        text: textBody,
      });
      return { ok: true, detail: `Email sent to ${cfg.to} via SMTP` };
    } catch (err) {
      return { ok: false, detail: `SMTP failed: ${err instanceof Error ? err.message : err}` };
    }
  }

  return {
    ok: false,
    detail: "Email not configured (set RESEND_API_KEY, or SMTP_HOST/USER/PASS)",
  };
}
