# RehabSync — Cron Management

A tiny, dependency-free Railway **Cron Job** that pings the scheduled-job endpoints of the RehabSync
internal tools. It exists because Vercel's Hobby plan can't run frequent crons.

It drives:

| App | Endpoint | Job |
|---|---|---|
| Sales Centre | `/api/cron/run-sequences` | Advance sequence steps |
| Sales Centre | `/api/cron/send-campaigns` | Send scheduled email campaigns |
| Ads Centre | `/api/cron/publish-due` | Publish due scheduled posts |
| Ads Centre | `/api/cron/send-newsletters` | Send due newsletters |
| Ads Centre | `/api/cron/sync-metrics` | Snapshot engagement / follower metrics (heaviest) |

> The main RehabSync platform runs its own background jobs on its Railway BullMQ worker — it does
> **not** need this. The Admin Centre has no scheduled jobs. So only Sales + Ads are driven here.

## How it stays cheap and safe

1. **`CRON_SECRET`** — the runner sends `Authorization: Bearer <CRON_SECRET>`; each endpoint rejects
   anything else (401).
2. **In-app Automation controllers** — each app has `Admin → Automation`. Pause a job there and the
   endpoint no-ops even when pinged. That's your spend kill-switch; this runner only wakes, curls,
   and exits (a few seconds per tick).

## Deploy (Railway)

1. **New service → Deploy from GitHub repo →** `Only1Antz89/rehabsync-CRON_management`.
2. Railway reads `railway.toml` here (Nixpacks build, `node run.mjs`, `*/15 * * * *`, restart
   policy `never`). No Root Directory needed — this repo *is* the service.
3. **Settings → Variables**, add:
   - `CRON_SECRET` — the **same** value set on the Sales and Ads Vercel projects.
   - `CRON_TARGETS` — comma- or newline-separated endpoint list (use your real domains):
     ```
     https://salescentre.rehabsync.app/api/cron/run-sequences,
     https://salescentre.rehabsync.app/api/cron/send-campaigns,
     https://adscentre.rehabsync.app/api/cron/publish-due,
     https://adscentre.rehabsync.app/api/cron/send-newsletters,
     https://adscentre.rehabsync.app/api/cron/sync-metrics
     ```
4. Deploy. Check the service **Logs** for `[cron] 200 …` lines after the first tick, then each app's
   **Automation** page for fresh "Last run" timestamps.

## Notes

- `sync-metrics` is the heaviest job (calls social APIs). To run it less often, drop its URL from
  `CRON_TARGETS` and add a second Railway cron service for just that URL on an hourly schedule — or
  simply **Pause** it from the Ads Centre Automation page.
- Local test: `CRON_SECRET=dev CRON_TARGETS="http://localhost:3000/api/cron/run-sequences" node run.mjs`
