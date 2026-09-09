/**
 * Catalogue of tracked NSE/BSE indices and the ETFs that track each one.
 *
 * Every symbol here was verified to resolve on Yahoo Finance and return INR
 * prices on the Asia/Kolkata exchange calendar.
 *
 * Note: Yahoo's "^NSMIDCP" is Nifty NEXT 50 despite the ticker looking like a
 * midcap one — it is labelled correctly below.
 */

export type Etf = {
  symbol: string;
  name: string;
  amc: string;
  /** Free-text note shown under the ETF in the suggestion card */
  note?: string;
};

export type TrackedIndex = {
  symbol: string;
  /** Matching indexSymbol in NSE's /api/allIndices, when one exists. */
  nseName?: string;
  name: string;
  /** Short name for tight UI spaces */
  short: string;
  group: "Broad" | "Sector" | "Commodity";
  /** Shown on the dashboard by default */
  featured: boolean;
  etfs: Etf[];
};

export const INDICES: TrackedIndex[] = [
  {
    symbol: "^NSEI",
    nseName: "NIFTY 50",
    name: "Nifty 50",
    short: "NIFTY",
    group: "Broad",
    featured: true,
    etfs: [
      { symbol: "NIFTYBEES.NS", name: "Nippon India ETF Nifty 50 BeES", amc: "Nippon India", note: "Oldest and most traded Nifty ETF — tightest bid/ask spread" },
      { symbol: "SETFNIF50.NS", name: "SBI Nifty 50 ETF", amc: "SBI", note: "Largest by AUM (the EPFO's Nifty vehicle)" },
      { symbol: "NIFTYIETF.NS", name: "ICICI Prudential Nifty 50 ETF", amc: "ICICI Prudential", note: "Highest daily traded volume of the Nifty ETFs" },
    ],
  },
  {
    symbol: "^BSESN",
    name: "S&P BSE Sensex",
    short: "SENSEX",
    group: "Broad",
    featured: true,
    etfs: [
      { symbol: "NIFTYBEES.NS", name: "Nippon India ETF Nifty 50 BeES", amc: "Nippon India", note: "Sensex ETFs are thinly traded — a Nifty 50 ETF is the liquid proxy" },
      { symbol: "SETFNIF50.NS", name: "SBI Nifty 50 ETF", amc: "SBI" },
    ],
  },
  {
    symbol: "^NSEBANK",
    nseName: "NIFTY BANK",
    name: "Nifty Bank",
    short: "BANKNIFTY",
    group: "Sector",
    featured: true,
    etfs: [
      { symbol: "BANKBEES.NS", name: "Nippon India ETF Nifty Bank BeES", amc: "Nippon India", note: "Most liquid bank ETF" },
      { symbol: "SETFNIFBK.NS", name: "SBI Nifty Bank ETF", amc: "SBI" },
    ],
  },
  {
    symbol: "^NSMIDCP",
    nseName: "NIFTY NEXT 50",
    name: "Nifty Next 50",
    short: "NEXT50",
    group: "Broad",
    featured: true,
    etfs: [
      { symbol: "JUNIORBEES.NS", name: "Nippon India ETF Nifty Next 50 Junior BeES", amc: "Nippon India", note: "The classic 'tomorrow's largecaps' ETF" },
    ],
  },
  {
    symbol: "^CRSLDX",
    nseName: "NIFTY 500",
    name: "Nifty 500",
    short: "NIFTY500",
    group: "Broad",
    featured: true,
    etfs: [
      { symbol: "NIFTYBEES.NS", name: "Nippon India ETF Nifty 50 BeES", amc: "Nippon India", note: "Broadest liquid proxy for a whole-market dip" },
      { symbol: "MID150BEES.NS", name: "Nippon India ETF Nifty Midcap 150", amc: "Nippon India" },
    ],
  },
  {
    symbol: "^CNXIT",
    nseName: "NIFTY IT",
    name: "Nifty IT",
    short: "IT",
    group: "Sector",
    featured: true,
    etfs: [
      { symbol: "ITBEES.NS", name: "Nippon India ETF Nifty IT", amc: "Nippon India", note: "Low unit price — easy to average down in small lots" },
    ],
  },
  {
    symbol: "^CNXPHARMA",
    nseName: "NIFTY PHARMA",
    name: "Nifty Pharma",
    short: "PHARMA",
    group: "Sector",
    featured: false,
    etfs: [
      { symbol: "PHARMABEES.NS", name: "Nippon India ETF Nifty Pharma", amc: "Nippon India" },
    ],
  },
  {
    symbol: "^CNXAUTO",
    nseName: "NIFTY AUTO",
    name: "Nifty Auto",
    short: "AUTO",
    group: "Sector",
    featured: false,
    etfs: [
      { symbol: "AUTOBEES.NS", name: "Nippon India ETF Nifty Auto", amc: "Nippon India" },
    ],
  },
  {
    symbol: "^CNXFMCG",
    nseName: "NIFTY FMCG",
    name: "Nifty FMCG",
    short: "FMCG",
    group: "Sector",
    featured: false,
    etfs: [
      { symbol: "CONSUMBEES.NS", name: "Nippon India ETF Nifty India Consumption", amc: "Nippon India", note: "Closest liquid consumption/FMCG basket" },
    ],
  },
  {
    symbol: "^CNXPSUBANK",
    nseName: "NIFTY PSU BANK",
    name: "Nifty PSU Bank",
    short: "PSUBANK",
    group: "Sector",
    featured: false,
    etfs: [
      { symbol: "PSUBNKBEES.NS", name: "Nippon India ETF Nifty PSU Bank BeES", amc: "Nippon India", note: "High beta — moves far more than Nifty on both sides" },
    ],
  },
  {
    symbol: "^CNXMETAL",
    nseName: "NIFTY METAL",
    name: "Nifty Metal",
    short: "METAL",
    group: "Sector",
    featured: false,
    etfs: [
      { symbol: "NIFTYBEES.NS", name: "Nippon India ETF Nifty 50 BeES", amc: "Nippon India", note: "No liquid metal ETF on NSE — broad index is the practical substitute" },
    ],
  },
  {
    symbol: "^CNXREALTY",
    nseName: "NIFTY REALTY",
    name: "Nifty Realty",
    short: "REALTY",
    group: "Sector",
    featured: false,
    etfs: [
      { symbol: "MID150BEES.NS", name: "Nippon India ETF Nifty Midcap 150", amc: "Nippon India", note: "No realty ETF on NSE — midcap 150 carries the closest exposure" },
    ],
  },
  {
    symbol: "^CNXENERGY",
    nseName: "NIFTY ENERGY",
    name: "Nifty Energy",
    short: "ENERGY",
    group: "Sector",
    featured: false,
    etfs: [
      { symbol: "NIFTYBEES.NS", name: "Nippon India ETF Nifty 50 BeES", amc: "Nippon India", note: "Energy heavyweights are already ~12% of the Nifty 50" },
    ],
  },
  {
    symbol: "GOLDBEES.NS",
    name: "Gold BeES (gold price proxy)",
    short: "GOLD",
    group: "Commodity",
    featured: false,
    etfs: [
      { symbol: "GOLDBEES.NS", name: "Nippon India ETF Gold BeES", amc: "Nippon India", note: "Tracks domestic gold price incl. import duty and INR" },
      { symbol: "SILVERBEES.NS", name: "Nippon India Silver ETF", amc: "Nippon India" },
    ],
  },
];

export const INDEX_BY_SYMBOL: Record<string, TrackedIndex> = Object.fromEntries(
  INDICES.map((i) => [i.symbol, i]),
);

/** Every distinct ETF symbol referenced anywhere in the catalogue. */
export const ALL_ETF_SYMBOLS: string[] = Array.from(
  new Set(INDICES.flatMap((i) => i.etfs.map((e) => e.symbol))),
);

export const ALL_INDEX_SYMBOLS: string[] = INDICES.map((i) => i.symbol);

export function etfsFor(indexSymbol: string): Etf[] {
  return INDEX_BY_SYMBOL[indexSymbol]?.etfs ?? [];
}

export function labelFor(symbol: string): string {
  return INDEX_BY_SYMBOL[symbol]?.name ?? symbol;
}
