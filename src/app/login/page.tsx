"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? "Login failed");
        return;
      }
      router.push(params.get("next") || "/");
      router.refresh();
    } catch {
      setError("Could not reach the server");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <div className="mb-6 flex items-center gap-2">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent text-lg font-bold text-ink-950">
          ₹
        </span>
        <div>
          <h1 className="text-lg font-bold">Nifty Dip Alerts</h1>
          <p className="text-xs text-ink-500">Indian market tracker</p>
        </div>
      </div>

      <form onSubmit={submit} className="card p-5">
        <label className="mb-1.5 block text-xs font-medium text-ink-300">Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Your APP_PASSWORD"
          autoFocus
        />
        {error && <p className="mt-2 text-xs text-down">{error}</p>}
        <button type="submit" disabled={busy} className="btn btn-primary mt-4 w-full">
          {busy ? "Checking…" : "Sign in"}
        </button>
      </form>

      <p className="mt-4 text-center text-[11px] leading-relaxed text-ink-500">
        Set <code className="text-ink-300">APP_PASSWORD</code> in your environment. If it is left
        blank, the app runs without a login.
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
