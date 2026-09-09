import { getQuotes, type Quote } from "./yahoo";
import { getNseSnapshot, toNseSymbol } from "./nse";
import { INDEX_BY_SYMBOL } from "./instruments";

/**
 * Single source of quotes for the rest of the app.
 *
 * NSE supplies the price fields — it is the exchange itself, publishes
 * previousClose explicitly, and covers the sector indices where Yahoo's daily
 * series has multi-week holes. Yahoo supplies the 20/50-day moving averages,
 * because neither NSE endpoint returns a historical series.
 *
 * If NSE is unreachable (it blocks many datacenter IP ranges) the Yahoo values
 * are used unchanged, so the app degrades to its previous behaviour rather than
 * failing.
 */

export type QuoteResult = {
  quotes: Record<string, Quote>;
  errors: Record<string, string>;
  /** Whether NSE data was actually applied on this call */
  nseOk: boolean;
  nseError: string | null;
  nseTimestamp: string | null;
  /** How many symbols ended up served by NSE rather than Yahoo */
  nseCount: number;
};

export async function getMarketQuotes(
  symbols: string[],
  opts: { fresh?: boolean } = {},
): Promise<QuoteResult> {
  // Both upstreams in parallel — Yahoo is still needed for the moving averages
  // even when NSE succeeds, and is the fallback when it does not.
  const [yahoo, nse] = await Promise.all([
    getQuotes(symbols, { fresh: opts.fresh }),
    getNseSnapshot({ fresh: opts.fresh }),
  ]);

  const quotes: Record<string, Quote> = { ...yahoo.quotes };
  const errors: Record<string, string> = { ...yahoo.errors };
  let nseCount = 0;

  if (nse.ok) {
    for (const symbol of new Set(symbols)) {
      const base = quotes[symbol];

      // Indices are keyed by NSE's own index name; ETFs by their trading symbol.
      const nseName = INDEX_BY_SYMBOL[symbol]?.nseName;
      const idx = nseName ? nse.indices[nseName] : undefined;
      const etf = symbol.endsWith(".NS") ? nse.etfs[toNseSymbol(symbol)] : undefined;

      if (!idx && !etf) continue;

      const price = idx ? idx.last : etf!.ltp;
      const prevClose = idx ? idx.previousClose : etf!.previousClose;
      const changePct = idx ? idx.changePct : etf!.changePct;
      const nav = etf?.nav ?? null;

      const dayHigh = idx ? idx.high : null;
      const dayLow = idx ? idx.low : null;

      quotes[symbol] = {
        // Keep Yahoo's derived analytics where NSE has no equivalent.
        symbol,
        name: base?.name ?? nseName ?? symbol,
        sma20: base?.sma20 ?? null,
        sma50: base?.sma50 ?? null,
        vsSma20Pct: base?.sma20 ? ((price - base.sma20) / base.sma20) * 100 : null,
        vsSma50Pct: base?.sma50 ? ((price - base.sma50) / base.sma50) * 100 : null,

        price,
        prevClose,
        change: price - prevClose,
        changePct,
        dayHigh,
        dayLow,
        fromDayHighPct: dayHigh ? ((price - dayHigh) / dayHigh) * 100 : null,
        volume: etf?.volume ?? base?.volume ?? null,
        currency: "INR",

        high52w: idx?.yearHigh ?? etf?.weekHigh ?? base?.high52w ?? null,
        low52w: idx?.yearLow ?? etf?.weekLow ?? base?.low52w ?? null,
        from52wHighPct: (() => {
          const h = idx?.yearHigh ?? etf?.weekHigh ?? base?.high52w ?? null;
          return h ? ((price - h) / h) * 100 : null;
        })(),

        asOf: new Date().toISOString(),
        stale: false,
        source: "nse",
        nav,
        navPremiumPct: nav ? ((price - nav) / nav) * 100 : null,
        // NSE publishes previousClose for the current session directly, so the
        // staleness problem that affects Yahoo's gapped series does not apply.
        prevCloseAgeDays: null,
        changeReliable: true,
      };

      delete errors[symbol];
      nseCount++;
    }
  }

  return {
    quotes,
    errors,
    nseOk: nse.ok,
    nseError: nse.error,
    nseTimestamp: nse.timestamp,
    nseCount,
  };
}
