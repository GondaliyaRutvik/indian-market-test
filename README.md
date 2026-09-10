# Nifty Dip Alerts

Tracks Indian market indices, alerts you when one falls (or rises) past a threshold you set, and shows the ETFs that track that index so you can act on the dip.

- **Data**: NSE India for prices (free, no key, and it covers the sector indices Yahoo's series has holes in), with Yahoo Finance for the 20/50-day averages and as an automatic fallback when NSE is unreachable.
- **Alerts**: Telegram, email, and an in-app notification feed. Per-rule channel selection.
- **Suggestions**: each index maps to the ETFs that track it, ranked by discount to their 20-day average.

> This app gives you information, not investment advice. It has made no suitability or risk assessment for you.

---

## What it tracks

| Index | Symbol | ETFs mapped |
| --- | --- | --- |
| Nifty 50 | `^NSEI` | NIFTYBEES, SETFNIF50, NIFTYIETF |
| S&P BSE Sensex | `^BSESN` | NIFTYBEES, SETFNIF50 (no liquid Sensex ETF) |
| Nifty Bank | `^NSEBANK` | BANKBEES, SETFNIFBK |
| Nifty Next 50 | `^NSMIDCP` | JUNIORBEES |
| Nifty 500 | `^CRSLDX` | NIFTYBEES, MID150BEES |
| Nifty IT | `^CNXIT` | ITBEES |
| Nifty Pharma | `^CNXPHARMA` | PHARMABEES |
| Nifty Auto | `^CNXAUTO` | AUTOBEES |
| Nifty FMCG | `^CNXFMCG` | CONSUMBEES |
| Nifty PSU Bank | `^CNXPSUBANK` | PSUBNKBEES |
| Nifty Metal / Realty / Energy | — | broad-index proxies (no liquid sector ETF) |
| Gold | `GOLDBEES.NS` | GOLDBEES, SILVERBEES |

Add or change these in [`src/lib/instruments.ts`](src/lib/instruments.ts).

---

## Setup

### 1. Database

Create a free Postgres at [neon.tech](https://neon.tech) (or Supabase) and copy the connection string.

```bash
cp .env.example .env.local
# then edit .env.local and fill in DATABASE_URL
```

Generate a `CRON_SECRET` and pick an `APP_PASSWORD` while you are in there:

```bash
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
```

### 2. Install and create the tables

```bash
npm install
npx prisma migrate deploy   # creates the tables from prisma/migrations/
npm run seed                # optional: 5 starter rules (Nifty 50 -1%, Bank -1%, etc.)
```

Use `migrate deploy`, **not** `prisma db push`. The Vercel build runs `migrate deploy`, and if the tables were created by `db push` instead it fails with *"database schema is not empty"*. If you already ran `db push` against this database, mark the migration as applied once:

```bash
npx prisma migrate resolve --applied 0_init
```

### 3. Run it

```bash
npm run dev
```

Open http://localhost:3000. If `APP_PASSWORD` is blank there is no login screen — that is fine locally, but set it before deploying.

### 4. Connect Telegram

1. In Telegram, message **@BotFather** → `/newbot` → copy the token.
2. Send any message to your new bot. (A bot cannot message you first.)
3. Open `https://api.telegram.org/bot<TOKEN>/getUpdates` and copy the numeric `chat.id`.
4. Paste both into **Settings**, enable Telegram, and hit **Send test message**.

### 5. Connect email

Pick one, set it in the environment, then set the recipient in **Settings**:

- **Resend** (easiest): sign up at [resend.com](https://resend.com), set `RESEND_API_KEY`. For testing you can send from `onboarding@resend.dev`; for your own `EMAIL_FROM` domain you must verify it.
- **Gmail SMTP**: enable 2-Step Verification, create an **App Password**, then set `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=587`, `SMTP_USER`, `SMTP_PASS`.

---

## Deploying

**For a complete free (₹0/month) deployment, follow [DEPLOY.md](DEPLOY.md)** — step by step, no card needed anywhere.

### Vercel

1. Push this repo to GitHub, import it in Vercel.
2. Add every variable from `.env.example` in **Project → Settings → Environment Variables**.
3. Deploy, then run `npm run migrate` once from your machine against the same database to create the tables. The build does not run migrations — see [DEPLOY.md](DEPLOY.md) for why.

### Which data sources work from Vercel

Your own Indian IP does **not** apply once deployed. Server-side fetches run on Vercel's machines, so NSE sees an AWS datacenter IP regardless of where you are sitting. NSE is known to block datacenter ranges, and this cannot be predicted — it has to be measured.

After your first deploy, open:

```
https://<your-app>.vercel.app/api/diagnostics
```

It probes Yahoo, NSE `allIndices`, NSE `etf` and Moneycontrol from the deployed server and tells you which respond, with latency, the region it ran in, and a recommendation. If NSE returns 403 it also retries with a cookie handshake.

Functions are pinned to `bom1` (Mumbai) in `vercel.json` — nearest region to the Indian data sources. Confirm `environment.region` reads `bom1` in the diagnostics output; if not, the pin did not take effect.

If NSE is blocked, the app keeps working on Yahoo Finance — that is the default and needs no change.

### Making alerts actually fire

This is the part people get wrong. The app does not poll on its own — something has to call `/api/cron/check` during market hours.

**Vercel Hobby only allows one cron run per day**, which is useless for intraday alerts. `vercel.json` therefore only schedules a single end-of-day check. For real polling use one of:

**cron-job.org (recommended, free, punctual)**

1. Create a job at [cron-job.org](https://cron-job.org).
2. URL: `https://<your-app>.vercel.app/api/cron/check`
3. Schedule: every 5 minutes, Mon–Fri, 03:45–10:00 **UTC** (= 09:15–15:30 IST).
4. Add a header: `Authorization: Bearer <your CRON_SECRET>`

> A GitHub Actions workflow was included at one point and has been removed. Its
> scheduler lagged 5-15 minutes under load, and running it alongside cron-job.org
> added a second thing to keep credentials in sync with — for no benefit, since
> the escalation ladder already prevents duplicate alerts.

**Or Railway / Render**, where a long-running process is allowed — or just your own machine:

```bash
npm run check            # respects market hours
npm run check -- --force # ignore market hours (weekend testing)
```

---

## How an alert is decided

For each enabled rule, every check:

1. Fetch the index quote — price and previous close from NSE, moving averages from Yahoo's daily closes.
2. Compute the metric — either `% vs previous close` or `% drawdown from today's high`.
3. Work out the **escalation level**: how many whole multiples of the threshold the move has reached. A 1% rule is at level 1 from -1.00% to -1.99%, level 2 from -2.00%, and so on.
4. Send only if that level is **higher than the last level alerted today**. The ladder resets each IST trading morning.
5. Fetch the mapped ETFs, sort by discount to their 20-day average, and attach them to the message.
6. Send on the enabled channels, and always write the event to the in-app feed as an audit trail.

**Why levels rather than a time cooldown?** A cooldown gets it wrong in both directions: too short and a sliding market sends a message every few minutes, too long and a genuine 1% to 3% collapse is suppressed because it happened inside the window. Levels track the thing you actually care about — whether it got materially worse.

**Why two bases?** `vs previous close` is the headline number everyone quotes. `from today's high` catches an index that opened strong and faded — a real intraday drop the headline number hides.

---

## Project layout

```
src/
  lib/
    quotes.ts         Resolver: NSE prices merged with Yahoo moving averages
    nse.ts            NSE allIndices + etf (includes NAV), cached
    yahoo.ts          Daily closes for SMA/52-week, and the fallback quote
    instruments.ts    Index catalogue, NSE name mapping, index -> ETF mapping
    engine.ts         Rule evaluation, ETF ranking, message rendering
    notify.ts         Telegram + email (Resend or SMTP) delivery
    market-hours.ts   NSE session logic, all in Asia/Kolkata
    auth.ts           Single-user signed-cookie gate
  app/
    page.tsx          Dashboard
    alerts/           Rule management + notification feed
    settings/         Channel configuration and test buttons
    api/cron/check/   The polling endpoint
scripts/
  seed.mjs            Starter alert rules
  run-check.mjs       Fire a check by hand
  test-smtp.mjs       Verify Gmail credentials without deploying
  engine.test.ts      50 assertions over the alert logic
```

---

## Tests

```bash
npm test
```

Covers rule triggering and boundaries, the stale-data guard, ETF ranking, message rendering and HTML escaping, and NSE market hours across the IST/UTC date boundary. No database or network needed.

---

## Notes and limits

- **Delay**: Yahoo quotes lag roughly 15 minutes. For a "buy this dip right now" workflow you want a broker API (Zerodha Kite, Upstox). `src/lib/yahoo.ts` is the only file that would need replacing — everything downstream consumes the `Quote` type.
- **Holidays**: the app does not carry an NSE holiday calendar. On a holiday Yahoo keeps returning the previous close, so the change stays near zero and nothing fires.
- **Yahoo has gaps in some sector indices.** At the time of writing, `^CNXFMCG`, `^CNXREALTY`, `^CNXMETAL`, `^CNXAUTO`, `^CNXPSUBANK` and `^CNXENERGY` had no daily bars for roughly two months. Taking the last two bars naively would report a two-month move as a one-day crash, so `Quote.changeReliable` is false whenever the previous close is more than 7 days old, and such a quote can never fire an alert. The dashboard shows "No recent previous close" instead of a percentage. Broad indices (Nifty 50, Sensex, Bank, Next 50, Nifty 500, IT, Pharma) were unaffected.
- **`chartPreviousClose` is not used**, deliberately. It is relative to the requested range — at `range=1y` it returns the close from a year ago, and at `range=1d` it was observed to be off by one session. Previous close comes from the daily bar series instead.
- **Sector ETFs**: NSE has no liquid Metal or Realty ETF, so those indices map to broad-market proxies. This is labelled in the UI rather than hidden.
- **Cooldown vs. a falling market**: on a day that keeps sliding, a 120-minute cooldown means about three alerts. Lower it if you want finer granularity.
