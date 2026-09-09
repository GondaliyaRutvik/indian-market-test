"use client";

import type { EtfSuggestion } from "@/lib/types";
import { inr, pct, compactVolume, toneClass } from "@/lib/format";

export default function EtfTable({ etfs }: { etfs: EtfSuggestion[] }) {
  if (!etfs.length) {
    return <p className="px-4 py-3 text-xs text-ink-500">No ETF mapped to this index.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[540px] text-sm">
        <thead>
          <tr className="text-left text-[10px] uppercase tracking-wider text-ink-500">
            <th className="px-4 py-2 font-medium">ETF</th>
            <th className="px-3 py-2 text-right font-medium">LTP</th>
            <th className="px-3 py-2 text-right font-medium">Day</th>
            <th className="px-3 py-2 text-right font-medium">vs 20-DMA</th>
            <th className="px-3 py-2 text-right font-medium">vs 50-DMA</th>
            <th className="px-3 py-2 text-right font-medium">Off 52w hi</th>
            <th className="px-4 py-2 text-right font-medium">Volume</th>
          </tr>
        </thead>
        <tbody>
          {etfs.map((e) => (
            <tr key={e.symbol} className="border-t border-ink-800 align-top">
              <td className="px-4 py-2.5">
                <div className="font-semibold">{e.symbol.replace(".NS", "")}</div>
                <div className="text-[11px] text-ink-500">{e.name}</div>
                {e.note && (
                  <div className="mt-0.5 max-w-xs text-[11px] italic leading-snug text-ink-500">
                    {e.note}
                  </div>
                )}
              </td>
              <td className="tabular px-3 py-2.5 text-right font-semibold">₹{inr(e.price)}</td>
              <td className={`tabular px-3 py-2.5 text-right ${toneClass(e.changePct)}`}>
                {pct(e.changePct)}
              </td>
              <td className={`tabular px-3 py-2.5 text-right ${toneClass(e.vsSma20Pct)}`}>
                {e.vsSma20Pct != null ? pct(e.vsSma20Pct, 1) : "—"}
              </td>
              <td className={`tabular px-3 py-2.5 text-right ${toneClass(e.vsSma50Pct)}`}>
                {e.vsSma50Pct != null ? pct(e.vsSma50Pct, 1) : "—"}
              </td>
              <td className="tabular px-3 py-2.5 text-right text-ink-300">
                {e.from52wHighPct != null ? `${e.from52wHighPct.toFixed(1)}%` : "—"}
              </td>
              <td className="tabular px-4 py-2.5 text-right text-ink-500">
                {compactVolume(e.volume)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
