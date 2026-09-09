import { NextResponse } from "next/server";
import { getSettings } from "@/lib/db";
import { requireSession } from "@/lib/guard";
import { sendTelegram, sendEmail } from "@/lib/notify";
import { getQuote } from "@/lib/yahoo";
import { formatIst } from "@/lib/market-hours";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Sends a real message through the requested channel using live Nifty data, so a
 * success here proves the whole delivery path works — not just the credentials.
 */
export async function POST(req: Request) {
  const denied = await requireSession();
  if (denied) return denied;

  const body = await req.json().catch(() => ({}));
  const channel = body.channel === "email" ? "email" : "telegram";
  const settings = await getSettings();

  let line = "Nifty 50 quote unavailable right now.";
  try {
    const q = await getQuote("^NSEI", { fresh: true });
    const sign = q.changePct >= 0 ? "+" : "";
    line =
      `Nifty 50 is at ${q.price.toLocaleString("en-IN", { minimumFractionDigits: 2 })} ` +
      `(${sign}${q.changePct.toFixed(2)}% vs previous close).`;
  } catch {
    /* fall through with the placeholder line */
  }

  const stamp = formatIst(new Date());

  if (channel === "telegram") {
    const result = await sendTelegram(
      settings,
      `✅ <b>Test alert</b>\n\nYour Telegram alerts are working.\n\n${line}\n\n<i>${stamp} IST</i>`,
    );
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  }

  const result = await sendEmail(
    settings,
    "Test alert — your market alerts are working",
    `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;padding:24px;">
       <h2 style="margin:0 0 8px;">✅ Test alert</h2>
       <p style="color:#374151;">Your email alerts are working.</p>
       <p style="color:#374151;">${line}</p>
       <p style="color:#9ca3af;font-size:12px;">${stamp} IST</p>
     </div>`,
    `Test alert — your email alerts are working.\n\n${line}\n\n${stamp} IST`,
  );
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
