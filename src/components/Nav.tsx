"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/alerts", label: "Alerts" },
  { href: "/settings", label: "Settings" },
];

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (pathname === "/login") return;
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/events?limit=1");
        if (!res.ok) return;
        const json = await res.json();
        if (alive) setUnread(json.unread ?? 0);
      } catch {
        /* nav badge is cosmetic — never surface a failure here */
      }
    };
    load();
    const t = setInterval(load, 60_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [pathname]);

  if (pathname === "/login") return null;

  async function logout() {
    await fetch("/api/login", { method: "DELETE" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-20 border-b border-ink-800 bg-ink-950/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-1 px-4 py-3 sm:px-6">
        <Link href="/" className="mr-3 flex items-center gap-2 font-bold tracking-tight">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent text-sm text-ink-950">
            ₹
          </span>
          <span className="hidden sm:inline">Nifty Dip Alerts</span>
        </Link>

        <nav className="flex items-center gap-1">
          {LINKS.map((l) => {
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  active ? "bg-ink-800 text-ink-100" : "text-ink-300 hover:bg-ink-850 hover:text-ink-100"
                }`}
              >
                {l.label}
                {l.href === "/alerts" && unread > 0 && (
                  <span className="ml-1.5 rounded-full bg-down px-1.5 py-0.5 text-[10px] font-bold text-white">
                    {unread}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <button onClick={logout} className="ml-auto text-xs text-ink-500 hover:text-ink-300">
          Sign out
        </button>
      </div>
    </header>
  );
}
