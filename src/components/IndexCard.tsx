"use client";

import type { IndexRow } from "@/lib/types";
import { inr, pct, toneClass } from "@/lib/format";

export default function IndexCard({ row }: { row: IndexRow }) {
  const q = row.quote;

  if (!q) {
    return (
      <div className="card p-4 opacity-50">
        <div className="text-sm font-semibold">{row.name}</div>
        <div className="mt-2 text-xs text-ink-500">Quote unavailable</div>
      </div>
    );
  }

  const down = q.changePct < 0;
  const big = q.changeReliable && Math.abs(q.changePct) >= 1;

  return (
    <div
      className={`card card-hover relative overflow-hidden p-4 ${
        big ? (down ? "border-down/40" : "border-up/40") : ""
      }`}
    >
      {big && (
        <span
          className={`absolute right-0 top-0 rounded-bl-lg px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
            down ? "bg-down/20 text-down" : "bg-up/20 text-up"
          }`}
        >
          {down ? "1%+ down" : "1%+ up"}
        </span>
      )}

      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold">{row.name}</span>
        {q.stale && <span className="text-[10px] text-accent">stale</span>}
      </div>

      <div className="mt-2 flex items-end justify-between gap-2">
        <span className="tabular text-xl font-bold">{inr(q.price)}</span>
        <span
          className={`tabular text-sm font-semibold ${
            q.changeReliable ? toneClass(q.changePct) : "text-ink-500"
          }`}
        >
          {q.changeReliable ? pct(q.changePct) : "—"}
        </span>
      </div>

      {q.changeReliable ? (
        <div className="tabular mt-1 text-[11px] text-ink-500">
          {q.change >= 0 ? "+" : ""}
          {inr(q.change)} from {inr(q.prevClose)}
        </div>
      ) : (
        <div
          className="mt-1 text-[11px] text-accent"
          title={`Yahoo's last two daily bars are ${q.prevCloseAgeDays} days apart, so a daily change cannot be computed.`}
        >
          No recent previous close ({q.prevCloseAgeDays}d gap)
        </div>
      )}

      <div className="mt-3 flex gap-3 border-t border-ink-800 pt-2 text-[11px] text-ink-500">
        <span>
          20-DMA{" "}
          <span className={`tabular ${toneClass(q.vsSma20Pct)}`}>
            {q.vsSma20Pct != null ? pct(q.vsSma20Pct, 1) : "—"}
          </span>
        </span>
        <span>
          50-DMA{" "}
          <span className={`tabular ${toneClass(q.vsSma50Pct)}`}>
            {q.vsSma50Pct != null ? pct(q.vsSma50Pct, 1) : "—"}
          </span>
        </span>
      </div>
    </div>
  );
}
