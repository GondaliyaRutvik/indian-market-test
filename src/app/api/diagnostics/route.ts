import { NextResponse } from "next/server";
import { requireSession } from "@/lib/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
// Mumbai. Nearest region to NSE, and removes any country-based check.
export const preferredRegion = "bom1";

/**
 * Reports which market-data sources are reachable FROM THE SERVER THIS RUNS ON.
 *
 * The point of this endpoint: NSE and Moneycontrol are known to block datacenter
 * IP ranges, so an endpoint that works from a home connection may be refused from
 * Vercel. That cannot be predicted — it has to be measured from the deployment
 * itself. Open /api/diagnostics on the deployed app to find out.
 */

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

const BROWSERISH = {
  "User-Agent": UA,
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  Referer: "https://www.nseindia.com/",
  Connection: "keep-alive",
};

type Probe = {
  source: string;
  url: string;
  ok: boolean;
  status: number | string;
  ms: number;
  sample: string | null;
  error: string | null;
};

async function probe(
  source: string,
  url: string,
  headers: Record<string, string>,
  extract: (body: string) => string,
  cookie?: string,
): Promise<Probe> {
  const started = Date.now();
  try {
    const res = await fetch(url, {
      headers: cookie ? { ...headers, Cookie: cookie } : headers,
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    const text = await res.text();
    const ms = Date.now() - started;

    if (!res.ok) {
      return {
        source, url, ok: false, status: res.status, ms, sample: null,
        error: `HTTP ${res.status} — ${text.slice(0, 120)}`,
      };
    }
    return { source, url, ok: true, status: res.status, ms, sample: extract(text), error: null };
  } catch (err) {
    return {
      source, url, ok: false, status: "network", ms: Date.now() - started, sample: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/** NSE sometimes only serves its API after the homepage has set cookies. */
async function nseCookies(): Promise<string | null> {
  try {
    const res = await fetch("https://www.nseindia.com/", {
      headers: { "User-Agent": UA, Accept: "text/html", "Accept-Language": "en-US,en;q=0.9" },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    const raw = res.headers.getSetCookie?.() ?? [];
    if (!raw.length) return null;
    return raw.map((c) => c.split(";")[0]).join("; ");
  } catch {
    return null;
  }
}

export async function GET() {
  const denied = await requireSession();
  if (denied) return denied;

  const jsonField = (body: string, pick: (j: unknown) => string) => {
    try {
      return pick(JSON.parse(body));
    } catch {
      return `unparseable (${body.slice(0, 60)})`;
    }
  };

  // Run the independent probes together; the cookie handshake has to come first
  // for the probe that depends on it.
  const cookie = await nseCookies();

  const probes = await Promise.all([
    probe("Yahoo Finance (current source)", "https://query1.finance.yahoo.com/v8/finance/chart/%5ENSEI?range=5d&interval=1d",
      { "User-Agent": UA }, (b) =>
        jsonField(b, (j) => {
          const m = (j as { chart?: { result?: { meta?: { regularMarketPrice?: number } }[] } })?.chart?.result?.[0]?.meta;
          return `Nifty ${m?.regularMarketPrice ?? "?"}`;
        })),

    probe("NSE allIndices (no cookie)", "https://www.nseindia.com/api/allIndices",
      BROWSERISH, (b) =>
        jsonField(b, (j) => {
          const o = j as { timestamp?: string; data?: { indexSymbol: string; last: number; percentChange: number }[] };
          const n = o.data?.find((x) => x.indexSymbol === "NIFTY 50");
          return `${o.data?.length ?? 0} indices · Nifty ${n?.last} (${n?.percentChange}%) · ts ${o.timestamp}`;
        })),

    probe("NSE ETF list (no cookie)", "https://www.nseindia.com/api/etf",
      BROWSERISH, (b) =>
        jsonField(b, (j) => {
          const o = j as { timestamp?: string; data?: { symbol: string; ltP: string; nav: string }[] };
          const e = o.data?.find((x) => x.symbol === "NIFTYBEES");
          return `${o.data?.length ?? 0} ETFs · NIFTYBEES ltp ${e?.ltP} nav ${e?.nav} · ts ${o.timestamp}`;
        })),

    probe("Moneycontrol priceapi", "https://priceapi.moneycontrol.com/pricefeed/notapplicable/inidicesindia/in%3BNSX",
      { "User-Agent": UA, Accept: "application/json" }, (b) =>
        jsonField(b, (j) => {
          const d = (j as { data?: Record<string, string> })?.data ?? {};
          return `Nifty ${d.pricecurrent} (${d.pricepercentchange}%) · lastupd ${d.lastupd}`;
        })),
  ]);

  // Only worth running if the cookie-free attempt was refused.
  const nseNoCookie = probes.find((p) => p.source.startsWith("NSE allIndices"));
  let nseWithCookie: Probe | null = null;
  if (cookie && nseNoCookie && !nseNoCookie.ok) {
    nseWithCookie = await probe("NSE allIndices (WITH cookie handshake)",
      "https://www.nseindia.com/api/allIndices", BROWSERISH,
      (b) => jsonField(b, (j) => {
        const o = j as { data?: unknown[] };
        return `${o.data?.length ?? 0} indices`;
      }), cookie);
  }

  const all = nseWithCookie ? [...probes, nseWithCookie] : probes;
  const working = all.filter((p) => p.ok).map((p) => p.source);

  // Email config shape — never the password itself, only the properties that
  // explain a 535 BadCredentials (Gmail app passwords are exactly 16 chars and
  // must have their display spaces removed).
  const pass = process.env.SMTP_PASS ?? "";
  const user = process.env.SMTP_USER ?? "";
  const email = {
    smtpHost: process.env.SMTP_HOST || "(not set)",
    smtpPort: process.env.SMTP_PORT || "(not set)",
    smtpUser: user || "(not set)",
    smtpUserLooksLikeEmail: user.includes("@"),
    smtpPassSet: pass.length > 0,
    smtpPassLength: pass.length,
    smtpPassHasSpaces: /\s/.test(pass),
    smtpPassLooksLikeGmailAppPassword: pass.replace(/\s/g, "").length === 16,
    resendKeySet: Boolean((process.env.RESEND_API_KEY ?? "").trim()),
    emailTo: process.env.EMAIL_TO || "(not set)",
    hint:
      pass.length === 0
        ? "SMTP_PASS is not set on this deployment."
        : /\s/.test(pass)
          ? "SMTP_PASS contains spaces — remove them (Google displays the app password as 4 groups of 4)."
          : pass.replace(/\s/g, "").length !== 16
            ? `SMTP_PASS is ${pass.length} characters. A Gmail App Password is exactly 16 — this looks like your normal account password, which Gmail always rejects.`
            : !user.includes("@")
              ? "SMTP_USER should be the full email address."
              : "Config shape looks correct. If auth still fails, regenerate the App Password.",
  };

  return NextResponse.json(
    {
      ranAt: new Date().toISOString(),
      environment: {
        onVercel: Boolean(process.env.VERCEL),
        region: process.env.VERCEL_REGION ?? "local",
        // bom1 = Mumbai. If this says something else on Vercel, the region pin
        // in vercel.json did not take effect.
        expectedRegion: "bom1",
      },
      cookieHandshake: cookie ? `got ${cookie.split(";").length} cookie(s)` : "no cookies returned",
      email,
      verdict: {
        working,
        nseUsable: all.some((p) => p.source.startsWith("NSE") && p.ok),
        recommendation: all.some((p) => p.source.startsWith("NSE allIndices") && p.ok)
          ? "NSE is reachable from this deployment — worth switching to it as the primary source."
          : "NSE is blocked from this deployment. Stay on Yahoo Finance, or move the data fetch to a machine on an Indian residential connection.",
      },
      probes: all,
    },
    { status: 200 },
  );
}
