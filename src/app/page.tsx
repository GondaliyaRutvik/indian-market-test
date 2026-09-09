"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { MarketPayload } from "@/lib/types";
import IndexCard from "@/components/IndexCard";
import EtfTable from "@/components/EtfTable";
import { pct } from "@/lib/format";

export default function Dashboard() {
  const [data, setData] = useState<MarketPayload | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/market");
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      setData(await res.json());
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load market data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

  if (loading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="card h-32 animate-pulse bg-ink-900" />
        ))}
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="card p-6 text-center">
        <p className="text-sm text-down">{error || "No data"}</p>
        <button onClick={load} className="btn btn-ghost mt-3">
          Retry
        </button>
      </div>
    );
  }

  const visible = showAll ? data.indices : data.indices.filter((i) => i.featured);
  const decliners = data.indices.filter((i) => i.quote && i.quote.changePct < 0).length;
  const breached = data.indices.filter((i) => i.quote && i.quote.changePct <= -1);

  return (
    <div className="space-y-6">
      {/* Status bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span
            className={`h-2 w-2 rounded-full ${
              data.market.open ? "live-dot bg-up" : "bg-ink-500"
            }`}
          />
          <div>
            <div className="text-sm font-semibold">
              {data.market.open ? "Market live" : data.market.label}
            </div>
            <div className="text-[11px] text-ink-500">{data.market.detail}</div>
          </div>
        </div>
        <div className="text-right text-[11px] text-ink-500">
          <div>Updated {data.asOfIst} IST</div>
          <div>
            {decliners} of {data.indices.length} indices down · refreshes every 60s
          </div>
        </div>
      </div>

      {/* 1% breach banner */}
      {breached.length > 0 && (
        <div className="card border-down/40 bg-down/5 p-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 text-lg">🔻</span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-down">
                {breached.length} {breached.length === 1 ? "index is" : "indices are"} down 1% or
                more
              </div>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-300">
                {breached.map((b) => (
                  <span key={b.symbol} className="tabular">
                    {b.name} <span className="text-down">{pct(b.quote!.changePct)}</span>
                  </span>
                ))}
              </div>
              <div className="mt-2 text-[11px] text-ink-500">
                Alerts are only sent for indices you have a rule for.{" "}
                <Link href="/alerts" className="text-accent hover:underline">
                  Manage alert rules →
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Index grid */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-300">
            Indices
          </h2>
          <button onClick={() => setShowAll((v) => !v)} className="text-xs text-accent hover:underline">
            {showAll ? "Show main only" : `Show all ${data.indices.length}`}
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {visible.map((row) => (
            <IndexCard key={row.symbol} row={row} />
          ))}
        </div>
      </section>

      {/* ETF suggestions */}
      <section>
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wider text-ink-300">
          ETFs on the dip
        </h2>
        <p className="mb-3 text-xs text-ink-500">
          Shown for any index down 0.5% or more, deepest discount to its 20-day average first.
        </p>

        {data.suggestions.length === 0 ? (
          <div className="card p-6 text-center text-sm text-ink-500">
            Nothing down 0.5% or more right now. This panel fills up on a red day.
          </div>
        ) : (
          <div className="space-y-3">
            {data.suggestions.map((s) => (
              <div key={s.indexSymbol} className="card overflow-hidden">
                <div className="flex items-center justify-between border-b border-ink-800 px-4 py-2.5">
                  <span className="text-sm font-semibold">{s.indexName}</span>
                  <span className="tabular text-sm font-semibold text-down">
                    {pct(s.changePct)}
                  </span>
                </div>
                <EtfTable etfs={s.etfs} />
              </div>
            ))}
          </div>
        )}
      </section>

      <p className="border-t border-ink-800 pt-4 text-[11px] leading-relaxed text-ink-500">
        Prices come from Yahoo Finance and may be delayed by roughly 15 minutes — treat levels as
        indicative, not executable. ETFs listed are those that track the index in question; this is
        information, not investment advice, and no suitability or risk assessment has been made for
        you.
      </p>
    </div>
  );
}
