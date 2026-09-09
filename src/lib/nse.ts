/**
 * NSE India client.
 *
 * Two endpoints cover everything we need, each in a single request:
 *   /api/allIndices  -> 139 indices with an explicit previousClose
 *   /api/etf         -> 350 ETFs with last price AND net asset value
 *
 * Why this exists alongside yahoo.ts: Yahoo's daily series has multi-week holes
 * for several NSE sector indices (FMCG, Realty, Metal, Auto, PSU Bank, Energy),
 * which made their daily change uncomputable. NSE carries them correctly, and
 * publishes previousClose directly rather than leaving it to be derived.
 *
 * Requires a browser-like User-Agent; a bare request gets no response at all.
 * NSE also blocks many datacenter IP ranges, so every caller must be prepared
 * for this to fail and fall back to Yahoo.
 */

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

const HEADERS = {
  "User-Agent": UA,
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  Referer: "https://www.nseindia.com/",
};

export type NseIndex = {
  name: string;
  last: number;
  previousClose: number;
  changePct: number;
  open: number | null;
  high: number | null;
  low: number | null;
  yearHigh: number | null;
  yearLow: number | null;
  advances: number | null;
  declines: number | null;
};

export type NseEtf = {
  symbol: string;
  ltp: number;
  previousClose: number;
  changePct: number;
  volume: number | null;
  nav: number | null;
  weekHigh: number | null;
  weekLow: number | null;
};

export type NseSnapshot = {
  indices: Record<string, NseIndex>;
  etfs: Record<string, NseEtf>;
  timestamp: string | null;
  ok: boolean;
  error: string | null;
};

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
};

let cache: { at: number; value: NseSnapshot } | null = null;
const CACHE_MS = 45_000;

async function fetchJson(url: string, signal?: AbortSignal) {
  const res = await fetch(url, { headers: HEADERS, cache: "no-store", signal });
  if (!res.ok) throw new Error(`NSE ${res.status} for ${url}`);
  return res.json();
}

export async function getNseSnapshot(opts: { fresh?: boolean } = {}): Promise<NseSnapshot> {
  if (!opts.fresh && cache && Date.now() - cache.at < CACHE_MS) return cache.value;

  const snapshot: NseSnapshot = {
    indices: {},
    etfs: {},
    timestamp: null,
    ok: false,
    error: null,
  };

  try {
    const signal = AbortSignal.timeout(12_000);
    const [idx, etf] = await Promise.all([
      fetchJson("https://www.nseindia.com/api/allIndices", signal),
      fetchJson("https://www.nseindia.com/api/etf", signal),
    ]);

    for (const row of idx?.data ?? []) {
      const name = String(row.indexSymbol ?? "").trim();
      const last = num(row.last);
      const prev = num(row.previousClose);
      if (!name || last === null || prev === null || prev === 0) continue;
      snapshot.indices[name] = {
        name,
        last,
        previousClose: prev,
        changePct: num(row.percentChange) ?? ((last - prev) / prev) * 100,
        open: num(row.open),
        high: num(row.high),
        low: num(row.low),
        yearHigh: num(row.yearHigh),
        yearLow: num(row.yearLow),
        advances: num(row.advances),
        declines: num(row.declines),
      };
    }

    for (const row of etf?.data ?? []) {
      const symbol = String(row.symbol ?? "").trim();
      const ltp = num(row.ltP);
      const prev = num(row.prevClose);
      if (!symbol || ltp === null || prev === null || prev === 0) continue;
      snapshot.etfs[symbol] = {
        symbol,
        ltp,
        previousClose: prev,
        changePct: num(row.per) ?? ((ltp - prev) / prev) * 100,
        volume: num(row.qty),
        nav: num(row.nav),
        weekHigh: num(row.wkhi),
        weekLow: num(row.wklo),
      };
    }

    snapshot.timestamp = idx?.timestamp ?? etf?.timestamp ?? null;
    snapshot.ok = Object.keys(snapshot.indices).length > 0;
    if (!snapshot.ok) snapshot.error = "NSE returned no usable index rows";
  } catch (err) {
    snapshot.error = err instanceof Error ? err.message : String(err);
  }

  // Serve the previous good snapshot if this attempt failed and one is cached.
  if (!snapshot.ok && cache?.value.ok) {
    return { ...cache.value, error: snapshot.error };
  }

  cache = { at: Date.now(), value: snapshot };
  return snapshot;
}

/** Strip the ".NS" Yahoo suffix to get the plain NSE trading symbol. */
export function toNseSymbol(yahooSymbol: string): string {
  return yahooSymbol.replace(/\.NS$/i, "");
}
