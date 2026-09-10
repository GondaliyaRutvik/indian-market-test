# Deploying free (₹0 / month)

Every piece of this runs on a free tier. Nothing here asks for a card.

| Piece | Service | Free allowance |
| --- | --- | --- |
| Code | GitHub | unlimited private repos |
| Hosting | Vercel **Hobby** | 300s function limit, 2 GB memory, 1 region |
| Database | Neon (or Supabase) | ~0.5 GB Postgres, sleeps when idle |
| Scheduler | **cron-job.org** | unlimited jobs, 1-minute resolution |
| Telegram | Telegram Bot API | unlimited |
| Email | Gmail SMTP *or* Resend | Gmail: ~500/day · Resend: 3,000/month |

The one thing you **cannot** use free is Vercel's own cron — see step 6.

---

## 1. Push to GitHub

```bash
git init
git add .
git commit -m "Nifty dip alerts"
git branch -M main
git remote add origin https://github.com/<you>/nifty-dip-alerts.git
git push -u origin main
```

A **private** repo is fine and costs nothing. Keep it private — `.env.local` is gitignored, but private is one less thing to worry about.

## 2. Free Postgres on Neon

1. Sign up at [neon.tech](https://neon.tech) with GitHub. No card.
2. Create a project — pick the **Singapore** or **Mumbai** region if offered (closest to you).
3. Copy the connection string. It looks like:
   `postgresql://user:pass@ep-xxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require`

Neon's free database **sleeps after ~5 minutes idle** and wakes on the next query, adding roughly a second to the first request. During market hours your cron hits it every 5 minutes, so it stays awake exactly when it matters.

> Supabase works equally well, but it **pauses free projects after 7 days of no activity**. Neon just sleeps and wakes. Prefer Neon for this.

## 3. Generate your secrets

```bash
node -e "console.log('CRON_SECRET  =', require('crypto').randomBytes(24).toString('hex'))"
node -e "console.log('APP_PASSWORD =', require('crypto').randomBytes(12).toString('base64url'))"
```

Keep these two lines somewhere — you need them in the next step and in step 6.

## 4. Deploy on Vercel

1. Sign up at [vercel.com](https://vercel.com) with GitHub. Choose **Hobby**. No card.
2. **Add New → Project**, import your repo.
3. Before clicking Deploy, open **Environment Variables** and add:

| Name | Value |
| --- | --- |
| `DATABASE_URL` | your Neon string |
| `APP_PASSWORD` | from step 3 |
| `CRON_SECRET` | from step 3 |
| `EMAIL_TO` | your email address |

4. Deploy.

The build runs `prisma generate && next build`. It deliberately does **not** run migrations: `prisma migrate deploy` takes a Postgres advisory lock, and against Neon that lock is held through pgbouncer and can time out with `P1002`, failing a deploy that had nothing to apply.

So create the tables once yourself, from your machine, pointed at the same database:

```bash
npm run migrate
```

Use the **direct** (non-pooled) connection string for this — the same host without `-pooler`. Repeat it only when the schema actually changes.

Vercel Hobby only allows one region, and `vercel.json` pins it to `bom1` (Mumbai) — closest to the Indian market data.

## 5. Check which data sources reach your deployment

Log in to your app, then open:

```
https://<your-app>.vercel.app/api/diagnostics
```

Read `environment.region` (should be `bom1`) and the `verdict`. This tells you whether NSE answers Vercel's IPs, which cannot be known in advance. If NSE is blocked, nothing breaks — the app runs on Yahoo Finance by default.

## 6. The scheduler — the one real free-tier catch

**Vercel Hobby cron only runs once per day**, with up to 59 minutes of drift. A more frequent expression *fails at deploy time* with:

> *Hobby accounts are limited to daily cron jobs.*

So `vercel.json` only schedules a single daily end-of-day check. For intraday alerts use **cron-job.org**, which is free and punctual:

1. Sign up at [cron-job.org](https://cron-job.org) (free, no card).
2. **Create cronjob**:
   - **URL**: `https://<your-app>.vercel.app/api/cron/check`
   - **Schedule**: every **5 minutes**, Mondays–Fridays
   - **Hours**: `3`–`10` — cron-job.org runs on **UTC**, and NSE's 09:15–15:30 IST is **03:45–10:00 UTC**
3. Under **Advanced → Headers**, add:
   - Name: `Authorization`
   - Value: `Bearer <your CRON_SECRET>`
4. Save, then hit **TEST RUN**. A 200 with `"skipped": true` outside market hours is correct — it means auth worked and the market-hours guard fired.

That single header is all that stands between your alert endpoint and the open internet, so don't skip it.

> There is deliberately no GitHub Actions fallback. One scheduler that fires on
> time beats two that need the same secrets kept in sync.

## 7. Telegram (free, 2 minutes)

1. Message **@BotFather** → `/newbot` → copy the token.
2. Send any message to your new bot — a bot cannot message you first.
3. Open `https://api.telegram.org/bot<TOKEN>/getUpdates`, copy the numeric `chat.id`.
4. In your app's **Settings**, paste both, enable Telegram, click **Send test message**.

## 8. Email (free)

**Gmail** — free, and you already have it:

1. Turn on 2-Step Verification on your Google account.
2. **Security → App passwords** → create one.
3. In Vercel, add: `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=587`, `SMTP_USER=<your gmail>`, `SMTP_PASS=<the 16-char app password>`.

**Resend** — 3,000 emails/month free, nicer deliverability. Set `RESEND_API_KEY` and send from `onboarding@resend.dev` until you own a domain.

Redeploy after adding env vars — Vercel does not apply them to a running deployment.

## 9. Seed your rules

Easiest is the **Alerts** page in the app. Or locally, pointed at the same Neon database:

```bash
npm run seed
```

Creates: Nifty 50 −1%, Bank Nifty −1%, Sensex −1%, Nifty IT −1.5%, Nifty Next 50 −1.5%.

---

## Staying inside the free tiers

Your actual load is tiny — one user, ~75 cron runs per trading day.

- **Vercel**: ~1,600 function calls/month against a very large Hobby allowance. Not close.
- **Neon**: a few hundred rows. The 0.5 GB limit is irrelevant. Watch compute hours if you ever poll every minute.
- **Keep the cron to market hours.** Polling 24/7 triples usage for zero benefit — the market is shut.
- **Old events**: `AlertEvent` grows slowly, but if it ever bothers you, "Mark all read" and the DELETE on `/api/events` clear it.

## What free costs you

- **Prices are NSE's published figures**, not tick data. Good enough for "Nifty fell 1% today"; not for timing an entry to the second. That needs a broker API (Kite/Upstox, ~₹2,000/month).
- **Moving averages come from Yahoo daily closes**, so they lag a live session slightly.
- **Cold starts.** First page load after an idle spell takes a second or two while Neon wakes.

## One rule to respect

Vercel's Hobby plan is for **non-commercial personal use**. Running this for yourself is exactly what it is for. If you ever charge people for it, you need Pro.
