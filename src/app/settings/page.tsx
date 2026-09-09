"use client";

import { useCallback, useEffect, useState } from "react";

type Status = {
  telegramToken: string;
  telegramChatId: string;
  emailRecipient: string;
  emailTransport: string;
};

export default function SettingsPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [telegramEnabled, setTelegramEnabled] = useState(false);
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [inAppEnabled, setInAppEnabled] = useState(true);
  const [marketHoursOnly, setMarketHoursOnly] = useState(true);
  const [botToken, setBotToken] = useState("");
  const [chatId, setChatId] = useState("");
  const [emailTo, setEmailTo] = useState("");
  const [msg, setMsg] = useState("");
  const [testMsg, setTestMsg] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/settings");
    if (!res.ok) return;
    const json = await res.json();
    setStatus(json.status);
    setTelegramEnabled(json.settings.telegramEnabled);
    setEmailEnabled(json.settings.emailEnabled);
    setInAppEnabled(json.settings.inAppEnabled);
    setMarketHoursOnly(json.settings.marketHoursOnly);
    setChatId(json.settings.telegramChatId);
    setEmailTo(json.settings.emailTo);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    setMsg("");
    const body: Record<string, unknown> = {
      telegramEnabled,
      emailEnabled,
      inAppEnabled,
      marketHoursOnly,
      telegramChatId: chatId,
      emailTo,
    };
    // Only send the token when the field was actually typed into, so saving the
    // form does not wipe a token that is already stored.
    if (botToken.trim()) body.telegramBotToken = botToken.trim();

    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setMsg(res.ok ? "Saved." : "Could not save.");
    setBotToken("");
    load();
  }

  async function test(channel: "telegram" | "email") {
    setTestMsg(`Sending ${channel} test…`);
    const res = await fetch("/api/test-notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel }),
    });
    const json = await res.json().catch(() => ({}));
    setTestMsg(json.detail ?? (res.ok ? "Sent." : "Failed."));
  }

  const Toggle = ({
    on,
    onChange,
    label,
    hint,
  }: {
    on: boolean;
    onChange: (v: boolean) => void;
    label: string;
    hint: string;
  }) => (
    <div className="flex items-start gap-3 py-2.5">
      <button
        onClick={() => onChange(!on)}
        className={`mt-0.5 h-5 w-9 shrink-0 rounded-full p-0.5 transition-colors ${
          on ? "bg-up" : "bg-ink-700"
        }`}
      >
        <span
          className={`block h-4 w-4 rounded-full bg-white transition-transform ${
            on ? "translate-x-4" : ""
          }`}
        />
      </button>
      <div>
        <div className="text-sm font-medium">{label}</div>
        <div className="text-[11px] leading-relaxed text-ink-500">{hint}</div>
      </div>
    </div>
  );

  return (
    <div className="max-w-2xl space-y-5">
      <div className="card p-5">
        <h2 className="mb-1 text-sm font-semibold">Channels</h2>
        <p className="mb-2 text-[11px] text-ink-500">
          A rule only sends on a channel that is enabled here and selected on the rule itself.
        </p>
        <div className="divide-y divide-ink-800">
          <Toggle
            on={telegramEnabled}
            onChange={setTelegramEnabled}
            label="Telegram"
            hint="Instant push to your phone. Fastest of the three."
          />
          <Toggle
            on={emailEnabled}
            onChange={setEmailEnabled}
            label="Email"
            hint="Full formatted alert with the ETF table."
          />
          <Toggle
            on={inAppEnabled}
            onChange={setInAppEnabled}
            label="In-app feed"
            hint="Every alert is written to the Notifications tab regardless — this controls the unread badge."
          />
          <Toggle
            on={marketHoursOnly}
            onChange={setMarketHoursOnly}
            label="Only during market hours"
            hint="Skip checks outside Mon-Fri 09:15-15:30 IST. Turn off to be alerted on after-hours moves too."
          />
        </div>
      </div>

      <div className="card p-5">
        <h2 className="mb-3 text-sm font-semibold">Telegram setup</h2>
        <ol className="mb-4 space-y-1.5 text-[11px] leading-relaxed text-ink-500">
          <li>
            1. In Telegram, message <span className="text-ink-300">@BotFather</span> and send{" "}
            <span className="text-ink-300">/newbot</span>. Copy the token it gives you.
          </li>
          <li>2. Send any message to your new bot (this is required before it can reply to you).</li>
          <li>
            3. Open{" "}
            <span className="text-ink-300">
              api.telegram.org/bot&lt;TOKEN&gt;/getUpdates
            </span>{" "}
            and copy the numeric <span className="text-ink-300">chat.id</span>.
          </li>
        </ol>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-[11px] text-ink-300">
              Bot token{" "}
              <span className="text-ink-500">
                (currently {status?.telegramToken ?? "…"})
              </span>
            </label>
            <input
              type="password"
              value={botToken}
              onChange={(e) => setBotToken(e.target.value)}
              placeholder="Leave blank to keep the stored token"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-ink-300">Chat ID</label>
            <input
              value={chatId}
              onChange={(e) => setChatId(e.target.value)}
              placeholder="e.g. 123456789"
            />
          </div>
          <button onClick={() => test("telegram")} className="btn btn-ghost">
            Send test message
          </button>
        </div>
      </div>

      <div className="card p-5">
        <h2 className="mb-1 text-sm font-semibold">Email setup</h2>
        <p className="mb-3 text-[11px] leading-relaxed text-ink-500">
          Transport is configured with environment variables — set{" "}
          <span className="text-ink-300">RESEND_API_KEY</span>, or{" "}
          <span className="text-ink-300">SMTP_HOST / SMTP_USER / SMTP_PASS</span> for Gmail. Current
          transport: <span className="text-ink-300">{status?.emailTransport ?? "…"}</span>
        </p>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-[11px] text-ink-300">Send alerts to</label>
            <input
              type="email"
              value={emailTo}
              onChange={(e) => setEmailTo(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
          <button onClick={() => test("email")} className="btn btn-ghost">
            Send test email
          </button>
        </div>
      </div>

      {testMsg && (
        <div className="card border-accent/30 p-3 text-xs text-ink-300">{testMsg}</div>
      )}

      <div className="flex items-center gap-3">
        <button onClick={save} className="btn btn-primary">
          Save settings
        </button>
        {msg && <span className="text-xs text-ink-300">{msg}</span>}
      </div>
    </div>
  );
}
