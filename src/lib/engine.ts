import type { AlertRule, Setting } from "@prisma/client";
import { prisma, getSettings } from "./db";
import { getQuotes, type Quote } from "./yahoo";
import { etfsFor, INDEX_BY_SYMBOL } from "./instruments";
import { isMarketOpen, formatIst } from "./market-hours";
import { sendEmail, sendTelegram, type DeliveryResult } from "./notify";

export type EtfSuggestion = {
  symbol: string;
  name: string;
  amc: string;
  note?: string;
  price: number;
  changePct: number;
  vsSma20Pct: number | null;
  vsSma50Pct: number | null;
  from52wHighPct: number | null;
  volume: number | null;
};

export type TriggerResult = {
  ruleId: string;
  symbol: string;
  label: string;
  changePct: number;
  fired: boolean;
  reason: string;
};

export type CheckSummary = {
  ranAt: string;
  marketOpen: boolean;
  skipped: boolean;
  skipReason?: string;
  rulesEvaluated: number;
  alertsFired: number;
  results: TriggerResult[];
  quoteErrors: Record<string, string>;
};

const fmt = (n: number, d = 2) =>
  n.toLocaleString("en-IN", { minimumFractionDigits: d, maximumFractionDigits: d });

const signed = (n: number, d = 2) => `${n >= 0 ? "+" : ""}${fmt(n, d)}`;

/**
 * The metric a rule is judged on.
 *  - prevClose: the headline % move vs yesterday's close
 *  - dayHigh:   intraday drawdown from today's high (always <= 0)
 */
export function metricFor(rule: AlertRule, q: Quote): number | null {
  if (rule.basis === "dayHigh") return q.fromDayHighPct;
  // Refuse to judge a move against a previous close that is weeks old — Yahoo's
  // series for some NSE sector indices has multi-week gaps, and treating one as a
  // single session would fire a spurious "down 7%" alert.
  if (!q.changeReliable) return null;
  return q.changePct;
}

export function ruleIsTriggered(rule: AlertRule, q: Quote): boolean {
  const metric = metricFor(rule, q);
  if (metric == null || !Number.isFinite(metric)) return false;
  const threshold = Math.abs(rule.thresholdPct);
  return rule.direction === "up" ? metric >= threshold : metric <= -threshold;
}

/** Ranked ETF ideas for a triggered index — deepest discount to its 20-DMA first. */
export function buildSuggestions(
  indexSymbol: string,
  quotes: Record<string, Quote>,
): EtfSuggestion[] {
  const rows: EtfSuggestion[] = [];

  for (const etf of etfsFor(indexSymbol)) {
    const q = quotes[etf.symbol];
    if (!q) continue;
    rows.push({
      symbol: etf.symbol,
      name: etf.name,
      amc: etf.amc,
      note: etf.note,
      price: q.price,
      changePct: q.changePct,
      vsSma20Pct: q.vsSma20Pct,
      vsSma50Pct: q.vsSma50Pct,
      from52wHighPct: q.from52wHighPct,
      volume: q.volume,
    });
  }

  return rows.sort((a, b) => (a.vsSma20Pct ?? 0) - (b.vsSma20Pct ?? 0));
}

// ---------------------------------------------------------------------------
// Message rendering
// ---------------------------------------------------------------------------

function basisPhrase(basis: string): string {
  return basis === "dayHigh" ? "from today's high" : "vs previous close";
}

export function renderTitle(rule: AlertRule, q: Quote, metric: number): string {
  const dir = metric < 0 ? "down" : "up";
  return `${rule.label} ${dir} ${fmt(Math.abs(metric))}%`;
}

export function renderTelegram(
  rule: AlertRule,
  q: Quote,
  metric: number,
  etfs: EtfSuggestion[],
): string {
  const emoji = metric < 0 ? "🔻" : "🟢";
  const lines: string[] = [];

  lines.push(`${emoji} <b>${escapeHtml(rule.label)} ${signed(metric)}%</b> ${escapeHtml(basisPhrase(rule.basis))}`);
  lines.push("");
  lines.push(`Level: <b>${fmt(q.price)}</b>  (prev close ${fmt(q.prevClose)})`);
  if (q.dayLow != null && q.dayHigh != null) {
    lines.push(`Day range: ${fmt(q.dayLow)} – ${fmt(q.dayHigh)}`);
  }
  if (q.vsSma20Pct != null) {
    lines.push(`Vs 20-DMA: ${signed(q.vsSma20Pct)}%   Vs 50-DMA: ${q.vsSma50Pct != null ? signed(q.vsSma50Pct) + "%" : "n/a"}`);
  }
  if (q.from52wHighPct != null) {
    lines.push(`Off 52-week high: ${fmt(q.from52wHighPct)}%`);
  }

  if (etfs.length) {
    lines.push("");
    lines.push("<b>ETFs tracking this index</b>");
    for (const e of etfs) {
      lines.push(
        `• <b>${escapeHtml(e.symbol.replace(".NS", ""))}</b> ₹${fmt(e.price)} (${signed(e.changePct)}%)` +
          (e.vsSma20Pct != null ? ` — ${signed(e.vsSma20Pct)}% vs 20-DMA` : ""),
      );
      if (e.note) lines.push(`   <i>${escapeHtml(e.note)}</i>`);
    }
  }

  lines.push("");
  lines.push(`<i>${escapeHtml(formatIst(new Date()))} IST · data may be delayed ~15 min · not investment advice</i>`);
  return lines.join("\n");
}

export function renderEmail(
  rule: AlertRule,
  q: Quote,
  metric: number,
  etfs: EtfSuggestion[],
): { html: string; text: string } {
  const down = metric < 0;
  const accent = down ? "#dc2626" : "#16a34a";

  const etfRows = etfs
    .map(
      (e) => `
      <tr>
        <td style="padding:10px 12px;border-top:1px solid #e5e7eb;">
          <div style="font-weight:600;color:#111827;">${escapeHtml(e.symbol.replace(".NS", ""))}</div>
          <div style="font-size:12px;color:#6b7280;">${escapeHtml(e.name)}</div>
          ${e.note ? `<div style="font-size:12px;color:#6b7280;font-style:italic;margin-top:4px;">${escapeHtml(e.note)}</div>` : ""}
        </td>
        <td style="padding:10px 12px;border-top:1px solid #e5e7eb;text-align:right;white-space:nowrap;">
          <div style="font-weight:600;">₹${fmt(e.price)}</div>
          <div style="font-size:12px;color:${e.changePct < 0 ? "#dc2626" : "#16a34a"};">${signed(e.changePct)}%</div>
        </td>
        <td style="padding:10px 12px;border-top:1px solid #e5e7eb;text-align:right;white-space:nowrap;font-size:13px;color:#374151;">
          ${e.vsSma20Pct != null ? signed(e.vsSma20Pct) + "%" : "—"}
        </td>
      </tr>`,
    )
    .join("");

  const html = `
<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:#f9fafb;padding:24px;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
    <div style="background:${accent};color:#fff;padding:20px 24px;">
      <div style="font-size:13px;opacity:.9;letter-spacing:.04em;text-transform:uppercase;">Market alert</div>
      <div style="font-size:24px;font-weight:700;margin-top:4px;">${escapeHtml(rule.label)} ${signed(metric)}%</div>
      <div style="font-size:13px;opacity:.9;margin-top:2px;">${escapeHtml(basisPhrase(rule.basis))}</div>
    </div>

    <div style="padding:20px 24px;">
      <table style="width:100%;border-collapse:collapse;font-size:14px;color:#374151;">
        <tr><td style="padding:4px 0;">Current level</td><td style="text-align:right;font-weight:600;color:#111827;">${fmt(q.price)}</td></tr>
        <tr><td style="padding:4px 0;">Previous close</td><td style="text-align:right;">${fmt(q.prevClose)}</td></tr>
        ${q.dayLow != null && q.dayHigh != null ? `<tr><td style="padding:4px 0;">Day range</td><td style="text-align:right;">${fmt(q.dayLow)} – ${fmt(q.dayHigh)}</td></tr>` : ""}
        ${q.vsSma20Pct != null ? `<tr><td style="padding:4px 0;">Vs 20-day average</td><td style="text-align:right;">${signed(q.vsSma20Pct)}%</td></tr>` : ""}
        ${q.vsSma50Pct != null ? `<tr><td style="padding:4px 0;">Vs 50-day average</td><td style="text-align:right;">${signed(q.vsSma50Pct)}%</td></tr>` : ""}
        ${q.from52wHighPct != null ? `<tr><td style="padding:4px 0;">Off 52-week high</td><td style="text-align:right;">${fmt(q.from52wHighPct)}%</td></tr>` : ""}
      </table>
    </div>

    ${
      etfs.length
        ? `<div style="padding:0 24px 8px;">
             <div style="font-size:13px;font-weight:600;color:#111827;text-transform:uppercase;letter-spacing:.04em;">ETFs tracking this index</div>
             <table style="width:100%;border-collapse:collapse;margin-top:8px;">
               <tr style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.04em;">
                 <th style="text-align:left;padding:0 12px 6px;">ETF</th>
                 <th style="text-align:right;padding:0 12px 6px;">Price</th>
                 <th style="text-align:right;padding:0 12px 6px;">vs 20-DMA</th>
               </tr>
               ${etfRows}
             </table>
           </div>`
        : ""
    }

    <div style="padding:16px 24px 24px;color:#9ca3af;font-size:11px;line-height:1.6;border-top:1px solid #e5e7eb;margin-top:12px;">
      ${escapeHtml(formatIst(new Date()))} IST · Prices from Yahoo Finance and may be delayed by roughly 15 minutes.<br>
      This is an automated notification generated from your own alert rules. It is information, not investment advice.
    </div>
  </div>
</div>`;

  const text =
    `${rule.label} ${signed(metric)}% ${basisPhrase(rule.basis)}\n` +
    `Level ${fmt(q.price)} (prev close ${fmt(q.prevClose)})\n` +
    (etfs.length
      ? `\nETFs:\n` +
        etfs
          .map(
            (e) =>
              `- ${e.symbol.replace(".NS", "")} Rs ${fmt(e.price)} (${signed(e.changePct)}%)` +
              (e.vsSma20Pct != null ? `, ${signed(e.vsSma20Pct)}% vs 20-DMA` : ""),
          )
          .join("\n")
      : "") +
    `\n\n${formatIst(new Date())} IST. Data may be delayed ~15 min. Not investment advice.`;

  return { html, text };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ---------------------------------------------------------------------------
// The check cycle
// ---------------------------------------------------------------------------

export async function runCheck(
  opts: { force?: boolean } = {},
): Promise<CheckSummary> {
  const ranAt = new Date().toISOString();
  const settings: Setting = await getSettings();
  const open = isMarketOpen();

  if (settings.marketHoursOnly && !open && !opts.force) {
    return {
      ranAt,
      marketOpen: open,
      skipped: true,
      skipReason: "Outside NSE trading hours (Mon-Fri 09:15-15:30 IST)",
      rulesEvaluated: 0,
      alertsFired: 0,
      results: [],
      quoteErrors: {},
    };
  }

  const rules = await prisma.alertRule.findMany({ where: { enabled: true } });
  if (rules.length === 0) {
    return {
      ranAt, marketOpen: open, skipped: false,
      rulesEvaluated: 0, alertsFired: 0, results: [], quoteErrors: {},
    };
  }

  // Fetch each watched index plus the ETFs we may need to quote in a message.
  const indexSymbols = Array.from(new Set(rules.map((r) => r.symbol)));
  const etfSymbols = Array.from(
    new Set(indexSymbols.flatMap((s) => etfsFor(s).map((e) => e.symbol))),
  );
  const { quotes, errors } = await getQuotes([...indexSymbols, ...etfSymbols], { fresh: true });

  const results: TriggerResult[] = [];
  let fired = 0;

  for (const rule of rules) {
    const q = quotes[rule.symbol];
    if (!q) {
      results.push({
        ruleId: rule.id, symbol: rule.symbol, label: rule.label,
        changePct: 0, fired: false,
        reason: errors[rule.symbol] ?? "no quote available",
      });
      continue;
    }

    const metric = metricFor(rule, q);
    if (metric == null) {
      const reason =
        rule.basis !== "dayHigh" && !q.changeReliable
          ? `previous close is ${q.prevCloseAgeDays ?? "?"} days old — data gap, not evaluated`
          : "metric unavailable";
      results.push({
        ruleId: rule.id, symbol: rule.symbol, label: rule.label,
        changePct: 0, fired: false, reason,
      });
      continue;
    }

    if (!ruleIsTriggered(rule, q)) {
      results.push({
        ruleId: rule.id, symbol: rule.symbol, label: rule.label,
        changePct: metric, fired: false,
        reason: `at ${signed(metric)}%, threshold ${rule.direction === "up" ? "+" : "-"}${rule.thresholdPct}%`,
      });
      continue;
    }

    // Cooldown: one bad day should not become fifty messages.
    if (rule.lastTriggeredAt) {
      const elapsedMin = (Date.now() - rule.lastTriggeredAt.getTime()) / 60000;
      if (elapsedMin < rule.cooldownMinutes) {
        results.push({
          ruleId: rule.id, symbol: rule.symbol, label: rule.label,
          changePct: metric, fired: false,
          reason: `cooling down (${Math.round(rule.cooldownMinutes - elapsedMin)} min left)`,
        });
        continue;
      }
    }

    const etfs = buildSuggestions(rule.symbol, quotes);
    const channels = rule.channels.split(",").map((c) => c.trim()).filter(Boolean);
    const title = renderTitle(rule, q, metric);
    const log: string[] = [];

    let telegramSent = false;
    if (channels.includes("telegram") && settings.telegramEnabled) {
      const r: DeliveryResult = await sendTelegram(settings, renderTelegram(rule, q, metric, etfs));
      telegramSent = r.ok;
      log.push(r.detail);
    }

    let emailSent = false;
    if (channels.includes("email") && settings.emailEnabled) {
      const { html, text } = renderEmail(rule, q, metric, etfs);
      const r = await sendEmail(settings, `${title} — market alert`, html, text);
      emailSent = r.ok;
      log.push(r.detail);
    }

    // The in-app feed is written regardless, so there is always an audit trail.
    await prisma.alertEvent.create({
      data: {
        ruleId: rule.id,
        symbol: rule.symbol,
        label: rule.label,
        price: q.price,
        prevClose: q.prevClose,
        changePct: metric,
        basis: rule.basis,
        title,
        message: `${rule.label} is ${signed(metric)}% ${basisPhrase(rule.basis)} at ${fmt(q.price)}.`,
        etfs: etfs as unknown as object,
        telegramSent,
        emailSent,
        deliveryLog: log.join(" | ") || null,
      },
    });

    await prisma.alertRule.update({
      where: { id: rule.id },
      data: { lastTriggeredAt: new Date() },
    });

    fired++;
    results.push({
      ruleId: rule.id, symbol: rule.symbol, label: rule.label,
      changePct: metric, fired: true,
      reason: log.join(" | ") || "recorded in-app",
    });
  }

  return {
    ranAt,
    marketOpen: open,
    skipped: false,
    rulesEvaluated: rules.length,
    alertsFired: fired,
    results,
    quoteErrors: errors,
  };
}

export { INDEX_BY_SYMBOL };
