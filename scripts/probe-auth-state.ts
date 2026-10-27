#!/usr/bin/env tsx
// Probe auth stability: open Flow and ImageFX, wait, track URL over time.
import { chromium } from 'playwright';
import * as fs from 'fs';
const PROFILE = '/root/.openclaw/workspace/google-flow-vps-profile-v2';
const OUT = '/root/.openclaw/workspace/AUTOMATION-LABGOOGLE/out';
function mask(s: string) { return s.replace(/([a-zA-Z0-9._%+-])[a-zA-Z0-9._%+-]*@([a-zA-Z0-9.-]+)/g, '$1***@$2'); }
(async () => {
  const ctx = await chromium.launchPersistentContext(PROFILE, {
    headless: true, args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
    viewport: { width: 1366, height: 900 }, locale: 'en-US', timezoneId: 'America/Los_Angeles',
  });
  const page = ctx.pages()[0] || (await ctx.newPage());
  const report: any = { flow: [], imagefx: [] };
  try {
    await page.goto('https://labs.google/fx/tools/flow', { waitUntil: 'domcontentloaded', timeout: 60000 });
    for (let t = 0; t <= 40; t += 5) {
      await page.waitForTimeout(5000);
      const snippet = await page.evaluate(`document.body ? document.body.innerText.replace(/\\s+/g,' ').slice(0,150) : ''`).catch(()=>'' as any);
      report.flow.push({ t: t + 5, url: mask(page.url()).slice(0, 100), snippet: mask(String(snippet)) });
    }
    await page.screenshot({ path: `${OUT}/probe-auth-flow.png`, fullPage: false });
    await page.goto('https://labs.google/fx/tools/image-fx', { waitUntil: 'domcontentloaded', timeout: 60000 });
    for (let t = 0; t <= 30; t += 5) {
      await page.waitForTimeout(5000);
      const snippet = await page.evaluate(`document.body ? document.body.innerText.replace(/\\s+/g,' ').slice(0,150) : ''`).catch(()=>'' as any);
      report.imagefx.push({ t: t + 5, url: mask(page.url()).slice(0, 100), snippet: mask(String(snippet)) });
    }
    await page.screenshot({ path: `${OUT}/probe-auth-imagefx.png`, fullPage: false });
  } catch (e: any) { report.error = String(e?.message || e); }
  fs.writeFileSync(`${OUT}/probe-auth-state.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 1));
  await ctx.close();
})();
