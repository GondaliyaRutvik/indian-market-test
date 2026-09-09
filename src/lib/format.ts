export const inr = (n: number, d = 2) =>
  n.toLocaleString("en-IN", { minimumFractionDigits: d, maximumFractionDigits: d });

export const pct = (n: number, d = 2) => `${n >= 0 ? "+" : ""}${n.toFixed(d)}%`;

export const compactVolume = (n: number | null) => {
  if (n == null) return "—";
  if (n >= 1e7) return `${(n / 1e7).toFixed(2)} Cr`;
  if (n >= 1e5) return `${(n / 1e5).toFixed(2)} L`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)} K`;
  return String(n);
};

export const toneClass = (n: number | null | undefined) =>
  n == null ? "text-ink-500" : n < 0 ? "text-down" : n > 0 ? "text-up" : "text-ink-300";
