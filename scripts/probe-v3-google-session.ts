#!/usr/bin/env tsx
// Probe: is the copied yt profile's core Google session alive? Test youtube.com + notebooklm + imagefx UI.
import { chromium } from 'playwright';
import * as fs from 'fs';
const PROFILE = '/root/.openclaw/workspace/google-flow-labgoogle-profile-v3';
const OUT = '/root/.openclaw/workspace/AUTOMATION-LABGOOGLE/out';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36';
function mask(s: string) { return s.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+/g, 'MASKED@EMAIL'); }
(async () => {
  const report: any = {};
  const ctx = await chromium.launchPersistentContext(PROFILE, {
    headless: true, userAgent: UA,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-blink-features=AutomationControlled'],
    viewport: { width: 1366, height: 900 },
  });
  try {
    const page = ctx.pages()[0] || (await ctx.newPage());
    // 1) YouTube signed in?
    await page.goto('https://www.youtube.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(9000);
    report.youtube = await page.evaluate(() => ({
      signedIn: !!document.querySelector('#avatar-btn, button#avatar-btn, ytd-topbar-menu-button-renderer img'),
      hasSignInBtn: /Sign in/.test((document.body.innerText || '').slice(0, 3000)),
    })).catch(() => null);
    await page.screenshot({ path: `${OUT}/v3probe-yt.png` }).catch(()=>{});
    // 2) NotebookLM
    await page.goto('https://notebooklm.google.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(10000);
    report.notebooklm = { url: mask(page.url()).slice(0, 120), authWall: /accounts\.google\.com/.test(page.url()) };
    await page.screenshot({ path: `${OUT}/v3probe-nlm.png` }).catch(()=>{});
  } catch (e: any) { report.error = String(e?.message || e).slice(0, 300); }
  fs.writeFileSync(`${OUT}/v3probe-gsession-report.json`, JSON.stringify(report, null, 2));
  console.log(mask(JSON.stringify(report, null, 1)));
  await ctx.close();
})();
