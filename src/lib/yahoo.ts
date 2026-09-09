/**
 * Minimal Yahoo Finance client.
 *
 * Uses the public chart endpoint, which returns BOTH the live quote (in `meta`)
 * and the daily close series in a single request — so one call per symbol gives
 * us the price, the previous close and the 20/50-day averages.
 *
 * No API key. Requires a browser-like User-Agent or Yahoo returns 403.
 */

const BASE = "https://query1.finance.yahoo.com/v8/finance/chart";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

export type Quote = {
  symbol: string;
  name: string;
  price: number;
  prevClose: number;
  change: number;
  changePct: number;
  dayHigh: number | null;
  dayLow: number | null;
  /** Percent drawdown from today's high; 0 when at the high, negative below it */
  fromDayHighPct: number | null;
  volume: number | null;
  currency: string;
  /** Simple moving averages from the daily close series */
  sma20: number | null;
  sma50: number | null;
  /** Percent distance of price vs the SMA. Negative = trading below the average */
  vsSma20Pct: number | null;
  vsSma50Pct: number | null;
  high52w: number | null;
  low52w: number | null;
  from52wHighPct: number | null;
  asOf: string;
  /** Served from cache because the live fetch failed */
  stale: boolean;
  /** Calendar days between the previous-close bar and the latest bar */
  prevCloseAgeDays: number | null;
  /**
   * False when the previous close is too old to be yesterday's — Yahoo's series
   * for some NSE sector indices has multi-week holes, which would otherwise make
   * a two-month move look like a one-day crash. changePct must not drive an alert
   * when this is false.
   */
  changeReliable: boolean;
};

/** A long weekend or festival cluster can legitimately span a few days. */
const MAX_PREV_CLOSE_AGE_DAYS = 7;

type CacheEntry = { at: number; value: Quote };
const cache = new Map<string, CacheEntry>();
const CACHE_MS = 45_000;

function sma(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const slice = values.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

function pctDiff(price: number, ref: number | null): number | null {
  if (ref == null || !Number.isFinite(ref) || ref === 0) return null;
  return ((price - ref) / ref) * 100;
}

async function fetchChart(symbol: string, signal?: AbortSignal) {
  const url = `${BASE}/${encodeURIComponent(symbol)}?range=1y&interval=1d`;
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    cache: "no-store",
    signal,
  });
  if (!res.ok) throw new Error(`Yahoo ${res.status} for ${symbol}`);
  const json = await res.json();
  const result = json?.chart?.result?.[0];
  if (!result?.meta) throw new Error(`No data returned for ${symbol}`);
  return result;
}

type Bar = { ts: number; close: number; high: number | null; low: number | null };

export async function getQuote(symbol: string, opts: { fresh?: boolean } = {}): Promise<Quote> {
  const hit = cache.get(symbol);
  if (!opts.fresh && hit && Date.now() - hit.at < CACHE_MS) return hit.value;

  const result = await fetchChart(symbol);
  const meta = result.meta;

  // Zip timestamps with OHLC before dropping anything: Yahoo emits null bars for
  // halted/holiday sessions, and filtering the arrays independently would slide
  // them out of alignment.
  const q0 = result?.indicators?.quote?.[0] ?? {};
  const rawCloses: (number | null)[] = q0.close ?? [];
  const rawHighs: (number | null)[] = q0.high ?? [];
  const rawLows: (number | null)[] = q0.low ?? [];
  const rawTs: number[] = result?.timestamp ?? [];

  const bars: Bar[] = [];
  for (let i = 0; i < rawCloses.length; i++) {
    const c = rawCloses[i];
    if (typeof c !== "number" || !Number.isFinite(c)) continue;
    bars.push({
      ts: rawTs[i] ?? 0,
      close: c,
      high: typeof rawHighs[i] === "number" ? rawHighs[i] : null,
      low: typeof rawLows[i] === "number" ? rawLows[i] : null,
    });
  }

  const lastBar = bars.at(-1) ?? null;
  const price: number = meta.regularMarketPrice ?? lastBar?.close ?? 0;

  // Previous close is the bar BEFORE the one the current price belongs to.
  //
  // meta.chartPreviousClose is deliberately not used: it is relative to the
  // requested range, so at range=1y it returns the close from a year ago, and at
  // range=1d it can be off by one session. meta.previousClose is absent for NSE
  // indices. The bar series is the only dependable source.
  const prevBar = bars.at(-2) ?? null;
  const prevClose: number = prevBar?.close ?? price;

  const prevCloseAgeDays =
    prevBar && lastBar && prevBar.ts && lastBar.ts
      ? Math.round((lastBar.ts - prevBar.ts) / 86400)
      : null;
  const changeReliable =
    prevBar !== null && prevCloseAgeDays !== null && prevCloseAgeDays <= MAX_PREV_CLOSE_AGE_DAYS;

  // The final bar is the session the current price belongs to — exclude it so the
  // moving average is a trailing reference rather than partly itself.
  const history = bars.slice(0, -1).map((b) => b.close);

  const s20 = sma(history, 20);
  const s50 = sma(history, 50);

  const allCloses = bars.map((b) => b.close);
  const high52w = meta.fiftyTwoWeekHigh ?? (allCloses.length ? Math.max(...allCloses) : null);
  const low52w = meta.fiftyTwoWeekLow ?? (allCloses.length ? Math.min(...allCloses) : null);

  const dayHigh: number | null = meta.regularMarketDayHigh ?? lastBar?.high ?? null;
  const dayLow: number | null = meta.regularMarketDayLow ?? lastBar?.low ?? null;

  const change = price - prevClose;
  const changePct = prevClose ? (change / prevClose) * 100 : 0;

  const quote: Quote = {
    symbol,
    name: meta.shortName || meta.longName || symbol,
    price,
    prevClose,
    change,
    changePct,
    dayHigh,
    dayLow,
    fromDayHighPct: pctDiff(price, dayHigh),
    volume: meta.regularMarketVolume ?? null,
    currency: meta.currency ?? "INR",
    sma20: s20,
    sma50: s50,
    vsSma20Pct: pctDiff(price, s20),
    vsSma50Pct: pctDiff(price, s50),
    high52w,
    low52w,
    from52wHighPct: pctDiff(price, high52w),
    asOf: new Date(
      (meta.regularMarketTime ? meta.regularMarketTime * 1000 : Date.now()),
    ).toISOString(),
    stale: false,
    prevCloseAgeDays,
    changeReliable,
  };

  cache.set(symbol, { at: Date.now(), value: quote });
  return quote;
}

/**
 * Fetch many symbols with bounded concurrency. A failing symbol never fails the
 * batch — it is simply absent from the returned map, and the caller degrades.
 */
export async function getQuotes(
  symbols: string[],
  opts: { fresh?: boolean; concurrency?: number } = {},
): Promise<{ quotes: Record<string, Quote>; errors: Record<string, string> }> {
  const limit = opts.concurrency ?? 6;
  const unique = Array.from(new Set(symbols));
  const quotes: Record<string, Quote> = {};
  const errors: Record<string, string> = {};

  let cursor = 0;
  async function worker() {
    while (cursor < unique.length) {
      const symbol = unique[cursor++];
      try {
        quotes[symbol] = await getQuote(symbol, { fresh: opts.fresh });
      } catch (err) {
        const stale = cache.get(symbol);
        if (stale) {
          quotes[symbol] = { ...stale.value, stale: true };
        }
        errors[symbol] = err instanceof Error ? err.message : String(err);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, unique.length) }, worker));
  return { quotes, errors };
}
