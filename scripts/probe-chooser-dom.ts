#!/usr/bin/env tsx
// probe-chooser-dom: inspect the account chooser DOM (masked), then attempt one click
// on the account row by coordinates. No password entry ever.
import { chromium } from 'playwright';
import * as fs from 'fs';

const PROFILE = process.env.LABGOOGLE_PROFILE || '/root/.openclaw/workspace/google-flow-vps-profile-v2';
const OUT = '/root/.openclaw/workspace/AUTOMATION-LABGOOGLE/out';
const mask = (s: string) => s.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+/g, 'MASKED@EMAIL');

(async () => {
  const ctx = await chromium.launchPersistentContext(PROFILE, {
    headless: true, args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
    viewport: { width: 1366, height: 900 }, locale: 'en-US', timezoneId: 'America/Los_Angeles',
  });
  const page = ctx.pages()[0] || (await ctx.newPage());
  await page.goto('https://labs.google/fx/tools/flow', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(8000);
  const report: any = { ts: new Date().toISOString(), url: page.url().replace(/[?#].*$/, '') };

  // dump candidate clickable rows
  report.candidates = await page.evaluate(() => {
    const rows: any[] = [];
    for (const el of document.querySelectorAll('li, div[role="link"], [data-identifier], [data-authuser]')) {
      const h = el as HTMLElement;
      const t = (h.textContent || '').replace(/\s+/g, ' ').trim();
      if (!t || t.length > 200) continue;
      if (!/@|Signed out|Use another/i.test(t)) continue;
      const r = h.getBoundingClientRect();
      rows.push({
        tag: h.tagName, role: h.getAttribute('role'), dataId: h.hasAttribute('data-identifier'),
        authuser: h.getAttribute('data-authuser'), visible: !!h.offsetParent,
        rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
        text: t.slice(0, 120),
      });
    }
    return rows;
  });
  report.candidates = report.candidates.map((c: any) => ({ ...c, text: mask(c.text) }));

  // pick the account row: has data-identifier OR contains 'Signed out', visible, reasonable size
  const target = report.candidates.find((c: any) => c.visible && c.rect.w > 200 && c.rect.h > 30 && /Signed out|MASKED@EMAIL/.test(c.text) && !/Use another|Remove/i.test(c.text));
  report.target = target || null;
  if (target) {
    await page.mouse.click(target.rect.x + target.rect.w / 2, target.rect.y + target.rect.h / 2);
    await page.waitForTimeout(10000);
    const url2 = page.url();
    report.afterClick = {
      url: url2.replace(/[?#].*$/, ''),
      authWall: /accounts\.google\.com/.test(url2),
      passwordField: await page.locator('input[type="password"]').count().catch(() => 0),
      head: mask(await page.evaluate(() => (document.body.innerText || '').slice(0, 400)).catch(() => '')),
    };
    const shot = `${OUT}/chooser-after-click-${Date.now()}.png`;
    await page.screenshot({ path: shot });
    report.shot = shot;
    // if we escaped accounts.google.com, wait & recheck app state
    if (!report.afterClick.authWall) {
      await page.waitForTimeout(6000);
      report.app = await page.evaluate(() => {
        const txt = (document.body.innerText || '').slice(0, 3000);
        return { newProj: /New project/i.test(txt), fields: [...document.querySelectorAll('[contenteditable="true"], textarea')].filter(e => (e as HTMLElement).offsetParent).length };
      }).catch(() => null);
      const shot2 = `${OUT}/chooser-app-${Date.now()}.png`;
      await page.screenshot({ path: shot2 });
      report.appShot = shot2;
    }
  }
  await ctx.close();
  fs.writeFileSync(`${OUT}/chooser-dom-report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
})();
