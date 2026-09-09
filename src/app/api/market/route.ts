import { NextResponse } from "next/server";
import { requireSession } from "@/lib/guard";
import { getQuotes } from "@/lib/yahoo";
import { INDICES, ALL_ETF_SYMBOLS } from "@/lib/instruments";
import { buildSuggestions } from "@/lib/engine";
import { marketStatus, formatIst } from "@/lib/market-hours";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Mumbai — closest region to the Indian market data sources.
export const preferredRegion = "bom1";

export async function GET() {
  const denied = await requireSession();
  if (denied) return denied;

  const indexSymbols = INDICES.map((i) => i.symbol);
  const { quotes, errors } = await getQuotes([...indexSymbols, ...ALL_ETF_SYMBOLS]);

  const indices = INDICES.map((idx) => {
    const q = quotes[idx.symbol];
    return {
      symbol: idx.symbol,
      name: idx.name,
      short: idx.short,
      group: idx.group,
      featured: idx.featured,
      quote: q ?? null,
      etfCount: idx.etfs.length,
    };
  });

  // Anything down 0.5% or more is worth surfacing an ETF idea for, even if the
  // user's own threshold has not been hit yet.
  const dipping = indices
    .filter((i) => i.quote && i.quote.changeReliable && i.quote.changePct <= -0.5)
    .sort((a, b) => (a.quote!.changePct ?? 0) - (b.quote!.changePct ?? 0));

  const suggestions = dipping.slice(0, 4).map((i) => ({
    indexSymbol: i.symbol,
    indexName: i.name,
    changePct: i.quote!.changePct,
    etfs: buildSuggestions(i.symbol, quotes),
  }));

  return NextResponse.json({
    asOf: new Date().toISOString(),
    asOfIst: formatIst(new Date()),
    market: marketStatus(),
    indices,
    suggestions,
    errors,
  });
}
