import { NextResponse } from "next/server";
import { prisma, getSettings } from "@/lib/db";
import { requireSession } from "@/lib/guard";
import { telegramConfig, emailConfig } from "@/lib/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Never ship a bot token back to the browser — only whether one exists. */
function present(v: string) {
  return v ? `set (…${v.slice(-4)})` : "not set";
}

export async function GET() {
  const denied = await requireSession();
  if (denied) return denied;

  const settings = await getSettings();
  const tg = telegramConfig(settings);
  const em = emailConfig(settings);

  return NextResponse.json({
    settings: {
      telegramEnabled: settings.telegramEnabled,
      telegramChatId: settings.telegramChatId ?? "",
      emailEnabled: settings.emailEnabled,
      emailTo: settings.emailTo ?? "",
      inAppEnabled: settings.inAppEnabled,
      marketHoursOnly: settings.marketHoursOnly,
    },
    status: {
      telegramToken: present(tg.token),
      telegramChatId: present(tg.chatId),
      emailRecipient: em.to || "not set",
      emailTransport: em.resendKey
        ? "Resend"
        : em.smtpHost
          ? `SMTP (${em.smtpHost})`
          : "not configured",
    },
  });
}

export async function PATCH(req: Request) {
  const denied = await requireSession();
  if (denied) return denied;

  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};

  for (const key of ["telegramEnabled", "emailEnabled", "inAppEnabled", "marketHoursOnly"]) {
    if (typeof body[key] === "boolean") data[key] = body[key];
  }
  // A blank string clears the value and falls back to the env var.
  if (typeof body.telegramBotToken === "string") {
    data.telegramBotToken = body.telegramBotToken.trim() || null;
  }
  if (typeof body.telegramChatId === "string") {
    data.telegramChatId = body.telegramChatId.trim() || null;
  }
  if (typeof body.emailTo === "string") {
    data.emailTo = body.emailTo.trim() || null;
  }

  await getSettings();
  await prisma.setting.update({ where: { id: "default" }, data });

  return NextResponse.json({ ok: true });
}
