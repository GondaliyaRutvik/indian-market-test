"use client";

import { useCallback, useEffect, useState } from "react";
import type { RuleRow, EventRow } from "@/lib/types";
import { INDICES } from "@/lib/instruments";
import { inr, pct, toneClass } from "@/lib/format";

const CHANNELS = [
  { id: "telegram", label: "Telegram" },
  { id: "email", label: "Email" },
  { id: "inapp", label: "In-app" },
];

export default function AlertsPage() {
  const [rules, setRules] = useState<RuleRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [tab, setTab] = useState<"rules" | "feed">("rules");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  // New-rule form
  const [symbol, setSymbol] = useState("^NSEI");
  const [threshold, setThreshold] = useState("1");
  const [direction, setDirection] = useState("down");
  const [basis, setBasis] = useState("prevClose");
  const [cooldown, setCooldown] = useState("120");
  const [channels, setChannels] = useState<string[]>(["telegram", "email", "inapp"]);

  const load = useCallback(async () => {
    const [r, e] = await Promise.all([fetch("/api/rules"), fetch("/api/events?limit=50")]);
    if (r.ok) setRules((await r.json()).rules);
    if (e.ok) setEvents((await e.json()).events);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function addRule(ev: React.FormEvent) {
    ev.preventDefault();
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol,
          thresholdPct: Number(threshold),
          direction,
          basis,
          cooldownMinutes: Number(cooldown),
          channels,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setMsg(json.error ?? "Could not create the rule");
        return;
      }
      setMsg("Rule created.");
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function patchRule(id: string, body: Record<string, unknown>) {
    await fetch(`/api/rules/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    load();
  }

  async function deleteRule(id: string) {
    await fetch(`/api/rules/${id}`, { method: "DELETE" });
    load();
  }

  async function markAllRead() {
    await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    load();
  }

  const toggleChannel = (id: string) =>
    setChannels((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));

  return (
    <div className="space-y-6">
      <div className="flex gap-1 border-b border-ink-800">
        {(["rules", "feed"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              tab === t
                ? "border-accent text-ink-100"
                : "border-transparent text-ink-500 hover:text-ink-300"
            }`}
          >
            {t === "rules" ? `Rules (${rules.length})` : `Notifications (${events.length})`}
          </button>
        ))}
      </div>

      {tab === "rules" && (
        <>
          {/* Create rule */}
          <form onSubmit={addRule} className="card p-5">
            <h2 className="mb-4 text-sm font-semibold">New alert rule</h2>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="mb-1 block text-[11px] text-ink-300">Index</label>
                <select value={symbol} onChange={(e) => setSymbol(e.target.value)}>
                  {INDICES.map((i) => (
                    <option key={i.symbol} value={i.symbol}>
                      {i.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-[11px] text-ink-300">Direction</label>
                <select value={direction} onChange={(e) => setDirection(e.target.value)}>
                  <option value="down">Falls by</option>
                  <option value="up">Rises by</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-[11px] text-ink-300">Threshold (%)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="50"
                  value={threshold}
                  onChange={(e) => setThreshold(e.target.value)}
                />
              </div>

              <div>
                <label className="mb-1 block text-[11px] text-ink-300">Measured</label>
                <select value={basis} onChange={(e) => setBasis(e.target.value)}>
                  <option value="prevClose">vs previous close</option>
                  <option value="dayHigh">from today&apos;s high</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-[11px] text-ink-300">Cooldown (minutes)</label>
                <input
                  type="number"
                  min="1"
                  max="1440"
                  value={cooldown}
                  onChange={(e) => setCooldown(e.target.value)}
                />
              </div>

              <div>
                <label className="mb-1 block text-[11px] text-ink-300">Send via</label>
                <div className="flex gap-1.5 pt-1">
                  {CHANNELS.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggleChannel(c.id)}
                      className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                        channels.includes(c.id)
                          ? "border-accent/50 bg-accent/15 text-accent"
                          : "border-ink-700 bg-ink-850 text-ink-500"
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-3">
              <button type="submit" disabled={busy} className="btn btn-primary">
                {busy ? "Saving…" : "Add rule"}
              </button>
              {msg && <span className="text-xs text-ink-300">{msg}</span>}
            </div>

            <p className="mt-3 text-[11px] leading-relaxed text-ink-500">
              &quot;From today&apos;s high&quot; catches an index that opened strong and then faded —
              a drop the headline number against yesterday&apos;s close would miss. Cooldown stops a
              single bad session from sending dozens of messages.
            </p>
          </form>

          {/* Existing rules */}
          {rules.length === 0 ? (
            <div className="card p-6 text-center text-sm text-ink-500">
              No rules yet. Add one above — &quot;Nifty 50 falls 1% vs previous close&quot; is the
              usual starting point.
            </div>
          ) : (
            <div className="space-y-2">
              {rules.map((r) => (
                <div key={r.id} className="card flex flex-wrap items-center gap-3 p-4">
                  <button
                    onClick={() => patchRule(r.id, { enabled: !r.enabled })}
                    title={r.enabled ? "Disable" : "Enable"}
                    className={`h-5 w-9 shrink-0 rounded-full p-0.5 transition-colors ${
                      r.enabled ? "bg-up" : "bg-ink-700"
                    }`}
                  >
                    <span
                      className={`block h-4 w-4 rounded-full bg-white transition-transform ${
                        r.enabled ? "translate-x-4" : ""
                      }`}
                    />
                  </button>

                  <div className="min-w-0 flex-1">
                    <div className={`text-sm font-semibold ${r.enabled ? "" : "text-ink-500"}`}>
                      {r.label} {r.direction === "up" ? "rises" : "falls"}{" "}
                      <span className={r.direction === "up" ? "text-up" : "text-down"}>
                        {r.thresholdPct}%
                      </span>{" "}
                      {r.basis === "dayHigh" ? "from today's high" : "vs previous close"}
                    </div>
                    <div className="mt-0.5 text-[11px] text-ink-500">
                      via {r.channels.split(",").join(", ")} · {r.cooldownMinutes} min cooldown
                      {r.lastTriggeredAt &&
                        ` · last fired ${new Date(r.lastTriggeredAt).toLocaleString("en-IN")}`}
                    </div>
                  </div>

                  {r.lastTriggeredAt && (
                    <button
                      onClick={() => patchRule(r.id, { resetCooldown: true })}
                      className="btn btn-ghost"
                    >
                      Reset cooldown
                    </button>
                  )}
                  <button onClick={() => deleteRule(r.id)} className="btn btn-danger">
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === "feed" && (
        <>
          <div className="flex justify-end">
            <button onClick={markAllRead} className="btn btn-ghost">
              Mark all read
            </button>
          </div>

          {events.length === 0 ? (
            <div className="card p-6 text-center text-sm text-ink-500">
              No alerts have fired yet.
            </div>
          ) : (
            <div className="space-y-2">
              {events.map((e) => (
                <div
                  key={e.id}
                  className={`card p-4 ${e.read ? "opacity-70" : "border-l-2 border-l-accent"}`}
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-sm font-semibold">{e.title}</span>
                    <span className="text-[11px] text-ink-500">
                      {new Date(e.createdAt).toLocaleString("en-IN", {
                        timeZone: "Asia/Kolkata",
                      })}{" "}
                      IST
                    </span>
                  </div>

                  <div className="tabular mt-1 text-xs text-ink-300">
                    {inr(e.price)} · <span className={toneClass(e.changePct)}>{pct(e.changePct)}</span>{" "}
                    {e.basis === "dayHigh" ? "from day high" : "vs prev close"}
                  </div>

                  {e.etfs && e.etfs.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {e.etfs.map((etf) => (
                        <span
                          key={etf.symbol}
                          className="tabular rounded-md bg-ink-850 px-2 py-1 text-[11px]"
                        >
                          {etf.symbol.replace(".NS", "")} ₹{inr(etf.price)}{" "}
                          <span className={toneClass(etf.changePct)}>{pct(etf.changePct)}</span>
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="mt-2 flex gap-2 text-[10px] text-ink-500">
                    <span className={e.telegramSent ? "text-up" : ""}>
                      Telegram {e.telegramSent ? "sent" : "not sent"}
                    </span>
                    <span className={e.emailSent ? "text-up" : ""}>
                      Email {e.emailSent ? "sent" : "not sent"}
                    </span>
                  </div>
                  {e.deliveryLog && (
                    <div className="mt-1 text-[10px] text-ink-500">{e.deliveryLog}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
