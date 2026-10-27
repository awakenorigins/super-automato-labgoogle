#!/usr/bin/env tsx
// probe-headful-recovery: same cookie-recovery click but HEADFUL under Xvfb
// (Google's "browser not secure" rejection often targets headless only).
// Policy: click account entry / Try again only. NEVER type passwords.
import { chromium, Page } from 'playwright';
import * as fs from 'fs';

const PROFILE = process.env.LABGOOGLE_PROFILE || '/root/.openclaw/workspace/google-flow-vps-profile-v2';
const OUT = '/root/.openclaw/workspace/AUTOMATION-LABGOOGLE/out';
const mask = (s: string) => s.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+/g, 'MASKED@EMAIL');

async function classify(page: Page) {
  const url = page.url();
  return {
    url: url.replace(/[?#].*$/, ''),
    authWall: /accounts\.google\.com/.test(url),
    kind: /accountchooser/.test(url) ? 'chooser' : /rejected/.test(url) ? 'rejected' : /confirmidentifier|challenge|pwd/.test(url) ? 'verify' : /accounts\.google\.com/.test(url) ? 'other-accounts' : 'app',
    passwordField: await page.locator('input[type="password"]').count().catch(() => 0),
    head: mask(await page.evaluate(() => (document.body.innerText || '').slice(0, 250)).catch(() => '')),
  };
}

(async () => {
  const ctx = await chromium.launchPersistentContext(PROFILE, {
    headless: false,
    args: ['--no-sandbox', '--disable-blink-features=AutomationControlled', '--disable-infobars', '--window-size=1366,900'],
    viewport: { width: 1366, height: 900 }, locale: 'en-US', timezoneId: 'America/Los_Angeles',
    ignoreDefaultArgs: ['--enable-automation'],
  });
  const page = ctx.pages()[0] || (await ctx.newPage());
  const report: any = { ts: new Date().toISOString(), mode: 'headful-xvfb', steps: [] };
  const proofs: string[] = [];
  const shoot = async (tag: string) => { const p = `${OUT}/headful-${tag}-${Date.now()}.png`; await page.screenshot({ path: p }).catch(() => {}); proofs.push(p); };

  await page.goto('https://labs.google/fx/tools/flow', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(9000);
  let st = await classify(page); await shoot('land'); report.steps.push({ step: 'land', ...st });

  for (let round = 1; round <= 2 && st.authWall && st.passwordField === 0; round++) {
    if (st.kind === 'chooser') {
      const row = await page.evaluate(() => {
        const lis = [...document.querySelectorAll('li')] as HTMLElement[];
        const el = lis.find(e => e.offsetParent && /@/.test(e.textContent || '') && !/Use another|Remove/i.test(e.textContent || ''));
        if (!el) return null; const r = el.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      }).catch(() => null as any);
      if (row) await page.mouse.click(row.x, row.y);
      report.steps.push({ step: `r${round}-click-account`, clicked: !!row });
    } else if (st.kind === 'rejected') {
      const btn = page.locator('button:has-text("Try again"), a:has-text("Try again")').first();
      if (await btn.count().catch(() => 0)) await btn.click({ timeout: 8000 }).catch(() => {});
      report.steps.push({ step: `r${round}-try-again` });
    } else break;
    await page.waitForTimeout(10000);
    st = await classify(page); await shoot(`r${round}-after`); report.steps.push({ step: `r${round}-after`, ...st });
  }

  if (!st.authWall) {
    await page.waitForTimeout(6000);
    report.app = await page.evaluate(() => {
      const txt = (document.body.innerText || '').slice(0, 3000);
      return { newProj: /New project/i.test(txt), fields: [...document.querySelectorAll('[contenteditable="true"], textarea')].filter(e => (e as HTMLElement).offsetParent).length };
    }).catch(() => null);
    await shoot('app');
    report.result = 'app-reached';
  } else {
    report.result = st.passwordField > 0 ? 'password-challenge' : `blocked-${st.kind}`;
  }
  report.proofs = proofs;
  try { await ctx.storageState({ path: '/root/.openclaw/workspace/google-flow-vps-storage-state-v2.json' }); } catch {}
  await ctx.close();
  fs.writeFileSync(`${OUT}/headful-recovery-report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
})();
