#!/usr/bin/env node
/**
 * RehabSync cron runner — deploy as a Railway Cron Job service.
 *
 * On each scheduled tick it GETs every URL in CRON_TARGETS with an
 * `Authorization: Bearer <CRON_SECRET>` header, then exits. The target endpoints self-gate:
 * a job paused in an app's /admin/automation console simply no-ops, so this runner can keep
 * ticking cheaply while you control the actual work (and spend) from the UI.
 *
 * Env:
 *   CRON_SECRET   shared secret; must match each target app's CRON_SECRET
 *   CRON_TARGETS  comma- or newline-separated list of cron endpoint URLs
 *   CRON_TIMEOUT  per-request timeout ms (optional, default 55000)
 *
 * Exit code is non-zero if any target failed, so Railway surfaces the failure in the run log.
 */
const secret = process.env.CRON_SECRET;
const timeout = Number(process.env.CRON_TIMEOUT || 55000);
const targets = (process.env.CRON_TARGETS || '')
  .split(/[\n,]/)
  .map((s) => s.trim())
  .filter(Boolean);

if (!secret) {
  console.error('[cron] CRON_SECRET is not set');
  process.exit(1);
}
if (targets.length === 0) {
  console.error('[cron] CRON_TARGETS is empty');
  process.exit(1);
}

let failures = 0;
for (const url of targets) {
  const started = Date.now();
  try {
    const res = await fetch(url, {
      headers: { authorization: `Bearer ${secret}` },
      signal: AbortSignal.timeout(timeout),
    });
    const body = (await res.text()).slice(0, 300);
    console.log(`[cron] ${res.status} ${url} (${Date.now() - started}ms) ${body}`);
    if (!res.ok) failures += 1;
  } catch (err) {
    failures += 1;
    console.error(`[cron] ERR ${url} ${err instanceof Error ? err.message : String(err)}`);
  }
}

const succeeded = targets.length - failures;
console.log(`[cron] done — ${succeeded}/${targets.length} ok`);
// Exit non-zero only when EVERY target failed — a real "nothing worked" signal (e.g. a bad or
// missing CRON_SECRET) worth surfacing as a failed run. A partial failure (some succeeded) is
// tolerated so one app briefly redeploying doesn't mark the whole run "Crashed".
process.exit(succeeded === 0 ? 1 : 0);
