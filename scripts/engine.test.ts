import { ruleIsTriggered, metricFor, buildSuggestions, renderTelegram, renderTitle, escalationStep, shouldFire } from "../src/lib/engine";
import { isMarketOpen, marketStatus, istNow } from "../src/lib/market-hours";
import type { Quote } from "../src/lib/yahoo";

let pass = 0, fail = 0;
function check(name: string, cond: boolean, extra = "") {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name} ${extra}`); }
}

function quote(over: Partial<Quote> = {}): Quote {
  return {
    symbol: "^NSEI", name: "NIFTY 50", price: 23431.5, prevClose: 23635.1,
    change: -203.6, changePct: -0.86, dayHigh: 23700, dayLow: 23400,
    fromDayHighPct: -1.13, volume: 100, currency: "INR",
    sma20: 24000, sma50: 24200, vsSma20Pct: -2.4, vsSma50Pct: -3.2,
    high52w: 26400, low52w: 22000, from52wHighPct: -11.2,
    asOf: new Date().toISOString(), stale: false,
    source: "yahoo", nav: null, navPremiumPct: null,
    prevCloseAgeDays: 1, changeReliable: true, ...over,
  };
}

function rule(over: Record<string, unknown> = {}) {
  return {
    id: "r1", symbol: "^NSEI", label: "Nifty 50", direction: "down",
    thresholdPct: 1, basis: "prevClose", enabled: true, cooldownMinutes: 120,
    channels: "telegram,email,inapp", lastTriggeredAt: null, createdAt: new Date(),
    lastTriggerStep: null, lastTriggerDay: null,
    ...over,
  } as never;
}

console.log("\n1. Rule triggering (down 1% vs previous close)");
check("-0.86% does NOT fire a 1% rule", !ruleIsTriggered(rule(), quote({ changePct: -0.86 })));
check("-1.00% fires (boundary is inclusive)", ruleIsTriggered(rule(), quote({ changePct: -1.0 })));
check("-1.46% fires", ruleIsTriggered(rule(), quote({ changePct: -1.46 })));
check("+2.00% does NOT fire a DOWN rule", !ruleIsTriggered(rule(), quote({ changePct: 2.0 })));
check("-0.99% does not fire", !ruleIsTriggered(rule(), quote({ changePct: -0.99 })));

console.log("\n2. Up rules");
check("+1.2% fires an UP 1% rule", ruleIsTriggered(rule({ direction: "up" }), quote({ changePct: 1.2 })));
check("-1.2% does NOT fire an UP rule", !ruleIsTriggered(rule({ direction: "up" }), quote({ changePct: -1.2 })));

console.log("\n3. Stale-data guard (the sector-index gap bug)");
const stale = quote({ changePct: -7.06, changeReliable: false, prevCloseAgeDays: 54 });
check("unreliable quote yields null metric", metricFor(rule(), stale) === null);
check("unreliable -7.06% does NOT fire", !ruleIsTriggered(rule(), stale));
check("dayHigh basis still works when changeReliable is false",
  metricFor(rule({ basis: "dayHigh" }), stale) === -1.13);

console.log("\n4. dayHigh basis");
check("-1.13% from day high does not fire a 2% rule",
  !ruleIsTriggered(rule({ basis: "dayHigh", thresholdPct: 2 }), quote()));
check("-2.50% from day high fires a 2% rule",
  ruleIsTriggered(rule({ basis: "dayHigh", thresholdPct: 2 }), quote({ fromDayHighPct: -2.5 })));

console.log("\n5. Threshold magnitude is treated as absolute");
check("negative threshold behaves like its magnitude",
  ruleIsTriggered(rule({ thresholdPct: -1 }), quote({ changePct: -1.5 })));

console.log("\n6. ETF suggestion ranking");
const quotes: Record<string, Quote> = {
  "NIFTYBEES.NS": quote({ symbol: "NIFTYBEES.NS", price: 268.15, vsSma20Pct: -2.8 }),
  "SETFNIF50.NS": quote({ symbol: "SETFNIF50.NS", price: 253.43, vsSma20Pct: -4.9 }),
  "NIFTYIETF.NS": quote({ symbol: "NIFTYIETF.NS", price: 266.76, vsSma20Pct: -1.4 }),
};
const sugg = buildSuggestions("^NSEI", quotes);
check("returns all three mapped ETFs", sugg.length === 3, `got ${sugg.length}`);
check("deepest discount to 20-DMA ranks first", sugg[0].symbol === "SETFNIF50.NS", sugg.map(s => s.symbol).join(","));
check("shallowest ranks last", sugg[2].symbol === "NIFTYIETF.NS");
check("missing ETF quote is skipped, not crashed",
  buildSuggestions("^NSEI", { "NIFTYBEES.NS": quotes["NIFTYBEES.NS"] }).length === 1);

console.log("\n7. Message rendering");
const msg = renderTelegram(rule(), quote({ changePct: -1.46 }), -1.46, sugg);
check("telegram message names the index", msg.includes("Nifty 50"));
check("telegram message shows the move", msg.includes("-1.46%"));
check("telegram message lists an ETF", msg.includes("SETFNIF50"));
check("telegram message carries the disclaimer", msg.includes("not investment advice"));
check("title reads naturally", renderTitle(rule(), quote(), -1.46) === "Nifty 50 down 1.46%",
  renderTitle(rule(), quote(), -1.46));
const evil = renderTelegram(rule({ label: "<script>alert(1)</script>" }), quote(), -1.46, []);
check("HTML in a label is escaped", !evil.includes("<script>") && evil.includes("&lt;script&gt;"));

console.log("\n8. NSE market hours (Asia/Kolkata)");
// 2026-09-09 is a Wednesday. Times below are UTC; IST = UTC+5:30.
check("09:14 IST Wed = closed", !isMarketOpen(new Date("2026-09-09T03:44:00Z")));
check("09:15 IST Wed = open", isMarketOpen(new Date("2026-09-09T03:45:00Z")));
check("12:00 IST Wed = open", isMarketOpen(new Date("2026-09-09T06:30:00Z")));
check("15:30 IST Wed = open (last minute)", isMarketOpen(new Date("2026-09-09T10:00:00Z")));
check("15:31 IST Wed = closed", !isMarketOpen(new Date("2026-09-09T10:01:00Z")));
check("Saturday noon = closed", !isMarketOpen(new Date("2026-09-12T06:30:00Z")));
check("Sunday noon = closed", !isMarketOpen(new Date("2026-09-13T06:30:00Z")));
check("pre-open is labelled", marketStatus(new Date("2026-09-09T02:00:00Z")).label === "Pre-open");
check("weekend detail mentions Monday", marketStatus(new Date("2026-09-12T06:30:00Z")).detail.includes("Monday"));
check("IST date key rolls correctly past UTC midnight",
  istNow(new Date("2026-09-09T19:30:00Z")).dateKey === "2026-09-10",
  istNow(new Date("2026-09-09T19:30:00Z")).dateKey);

console.log("\n9. Escalation ladder — one alert per level per day");
const D = "2026-09-10";
const r1 = rule({ thresholdPct: 1 });
check("-0.9% is step 0", escalationStep(r1, -0.9) === 0);
check("-1.0% is step 1", escalationStep(r1, -1.0) === 1);
check("-1.9% is still step 1", escalationStep(r1, -1.9) === 1);
check("-2.0% is step 2 (no float drift)", escalationStep(r1, -2.0) === 2, String(escalationStep(r1, -2.0)));
check("-3.4% is step 3", escalationStep(r1, -3.4) === 3);
check("1.5% rule: -3.0% is step 2", escalationStep(rule({ thresholdPct: 1.5 }), -3.0) === 2);
check("up rule: +2.2% is step 2", escalationStep(rule({ direction: "up", thresholdPct: 1 }), 2.2) === 2);

check("first hit of -1% fires", shouldFire(r1, -1.05, D).fire);
const fired1 = rule({ thresholdPct: 1, lastTriggerStep: 1, lastTriggerDay: D });
check("-1.4% does NOT re-fire after level 1", !shouldFire(fired1, -1.4, D).fire);
check("-1.9% does NOT re-fire after level 1", !shouldFire(fired1, -1.9, D).fire);
check("-2.0% DOES fire (doubled)", shouldFire(fired1, -2.0, D).fire);
check("-3.1% fires as step 3", shouldFire(fired1, -3.1, D).step === 3 && shouldFire(fired1, -3.1, D).fire);
const fired3 = rule({ thresholdPct: 1, lastTriggerStep: 3, lastTriggerDay: D });
check("-3.5% silent after level 3", !shouldFire(fired3, -3.5, D).fire);
check("recovery to -1.2% stays silent", !shouldFire(fired3, -1.2, D).fire);
check("ladder resets on a new trading day", shouldFire(fired3, -1.05, "2026-09-11").fire);
check("suppressed reason names the next level",
  shouldFire(fired1, -1.4, D).reason.includes("next alert at -2.00%"),
  shouldFire(fired1, -1.4, D).reason);
check("below threshold never fires", !shouldFire(r1, -0.5, D).fire);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
