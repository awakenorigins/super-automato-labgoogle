#!/usr/bin/env node
/**
 * flow-keeper.mjs — Launch ONE long-lived Flow Chrome with a CDP port and keep it warm.
 * Commands then connect over CDP (LABGOOGLE_CDP=http://127.0.0.1:PORT) instead of cold-launching
 * chromium every call — avoids the heavy per-call startup that gets SIGKILLed under high VPS load.
 *
 *   xvfb-run -a node scripts/flow-keeper.mjs   (keeps running; Ctrl-C / kill to stop)
 *   PORT default 18899. Profile from LABGOOGLE_PROFILE.
 */
import { chromium } from 'playwright';

const PROFILE = process.env.LABGOOGLE_PROFILE || '/root/.openclaw/workspace/google-flow-vps-profile-v2';
const PORT = Number(process.env.FLOW_KEEPER_PORT || 18899);
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36';

const ctx = await chromium.launchPersistentContext(PROFILE, {
  headless: false,
  userAgent: UA,
  viewport: { width: 1366, height: 900 },
  locale: 'en-US',
  timezoneId: 'America/Los_Angeles',
  acceptDownloads: true,
  args: [
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--disable-blink-features=AutomationControlled',
    '--window-size=1366,900',
    `--remote-debugging-port=${PORT}`,
    '--remote-debugging-address=127.0.0.1',
  ],
});
const page = ctx.pages()[0] || await ctx.newPage();
await page.goto('https://labs.google/fx/tools/flow', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
console.log(JSON.stringify({ keeper: 'up', cdp: `http://127.0.0.1:${PORT}`, profile: PROFILE }));

// Keep alive; refresh Flow every 5 min so the session/token stays warm.
setInterval(async () => {
  try { const p = ctx.pages()[0]; if (p) await p.reload({ waitUntil: 'domcontentloaded', timeout: 60000 }); } catch {}
}, 300000);

process.on('SIGTERM', async () => { try { await ctx.close(); } catch {} process.exit(0); });
process.on('SIGINT', async () => { try { await ctx.close(); } catch {} process.exit(0); });
// hold open
await new Promise(() => {});
