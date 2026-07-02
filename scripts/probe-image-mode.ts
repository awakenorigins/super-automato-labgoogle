#!/usr/bin/env tsx
// Probe: does Flow expose an Image / Ingredients output mode? Dump candidate UI.
import { chromium } from 'playwright';
import * as fs from 'fs';

const PROFILE = '/root/.openclaw/workspace/google-flow-vps-profile-v2';
const OUT = '/root/.openclaw/workspace/AUTOMATION-LABGOOGLE/out';

(async () => {
  const ctx = await chromium.launchPersistentContext(PROFILE, {
    headless: true, args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
    viewport: { width: 1366, height: 900 }, locale: 'en-US', timezoneId: 'America/Los_Angeles',
  });
  const page = ctx.pages()[0] || (await ctx.newPage());
  const report: any = { steps: [] };
  try {
    for (let attempt = 0; attempt < 4; attempt++) {
      await page.goto('https://labs.google/fx/tools/flow', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(7000);
      if (!/accounts\.google\.com/.test(page.url())) break;
      report.steps.push(`attempt ${attempt}: landed on accounts, retrying`);
      const acct = page.locator('button:has-text("@gmail.com"), [data-identifier], li[role="link"]').first();
      if (await acct.count().catch(()=>0)) { await acct.click({timeout:8000}).catch(()=>{}); await page.waitForTimeout(9000); }
      if (!/accounts\.google\.com/.test(page.url())) break;
    }
    report.url = page.url();
    for (let i = 0; i < 4; i++) { await page.keyboard.press('Escape').catch(()=>{}); await page.waitForTimeout(800); }
    await page.screenshot({ path: `${OUT}/probe-img-home.png`, fullPage: true });
    const nb = page.locator('button:has-text("New project"), [role="button"]:has-text("New project")').first();
    if (await nb.count().catch(()=>0)) { await nb.click({ timeout: 8000 }).catch(()=>{}); report.steps.push('clicked New project'); }
    await page.waitForTimeout(9000);
    for (let i = 0; i < 4; i++) { await page.keyboard.press('Escape').catch(()=>{}); await page.waitForTimeout(800); }
    await page.screenshot({ path: `${OUT}/probe-img-composer.png`, fullPage: true });
    const ui = await page.evaluate(`(() => {
      const vis = (e) => e.offsetParent !== null;
      const btns = Array.from(document.querySelectorAll('button,[role="button"],[role="combobox"],[role="tab"],select'))
        .filter(vis)
        .map(e => ({ tag: e.tagName, txt: (e.textContent||'').replace(/\\s+/g,' ').trim().slice(0,80), aria: e.getAttribute('aria-label')||'' }))
        .filter(x => x.txt || x.aria);
      const matches = ((document.body.innerText||'').match(/[^\\n]*?(Ingredients|Image|Frames)[^\\n]*/gi)||[]).slice(0,30);
      return { btns, matches };
    })()`);
    report.ui = ui;
    const modeBtn = await page.evaluate(`(() => {
      const vis = (e) => e.offsetParent !== null;
      const el = Array.from(document.querySelectorAll('button,[role="button"],[role="combobox"]'))
        .filter(vis)
        .find(e => /text to video|frames to video|ingredients to video|ingredients|create with/i.test((e.textContent||'') + (e.getAttribute('aria-label')||'')));
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.x + r.width/2, y: r.y + r.height/2, txt: (el.textContent||'').slice(0,60) };
    })()`);
    report.modeBtn = modeBtn;
    if (modeBtn) {
      await page.mouse.click((modeBtn as any).x, (modeBtn as any).y);
      await page.waitForTimeout(3000);
      await page.screenshot({ path: `${OUT}/probe-img-mode-open.png`, fullPage: true });
      const menu = await page.evaluate(`(() => {
        const vis = (e) => e.offsetParent !== null;
        return Array.from(new Set(Array.from(document.querySelectorAll('[role="option"],[role="menuitem"],li'))
          .filter(vis).map(e => (e.textContent||'').replace(/\\s+/g,' ').trim().slice(0,80)).filter(Boolean))).slice(0,40);
      })()`);
      report.modeMenu = menu;
    }
  } catch (e: any) { report.error = String(e?.message || e); }
  fs.writeFileSync(`${OUT}/probe-image-mode.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report).slice(0, 3000));
  await ctx.close();
})();
