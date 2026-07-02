#!/usr/bin/env tsx
// probe-signin-recovery: on the Google account chooser, click the account entry and
// see whether Google re-accepts the existing cookies (no password ever typed).
// Max 2 rounds per target. Screenshots every state. No secrets printed.
import { chromium, Page } from 'playwright';
import * as fs from 'fs';

const PROFILE = process.env.LABGOOGLE_PROFILE || '/root/.openclaw/workspace/google-flow-vps-profile-v2';
const OUT = '/root/.openclaw/workspace/AUTOMATION-LABGOOGLE/out';
const mask = (s: string) => s.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+/g, 'MASKED@EMAIL');

async function classify(page: Page) {
  const url = page.url();
  const txt = await page.evaluate(() => (document.body.innerText || '').slice(0, 2500)).catch(() => '');
  return {
    url: url.replace(/[?#].*$/, ''),
    authWall: /accounts\.google\.com/.test(url),
    kind: /accountchooser/.test(url) ? 'chooser'
      : /confirmidentifier|pwd|challenge|signin\/v2/.test(url) ? 'verify-or-password'
      : /signin\/rejected/.test(url) ? 'rejected'
      : /accounts\.google\.com/.test(url) ? 'accounts-other' : 'app',
    passwordField: await page.locator('input[type="password"]').count().catch(() => 0),
    head: mask(txt.slice(0, 300)),
  };
}

async function shoot(page: Page, tag: string, proofs: string[]) {
  const p = `${OUT}/recovery-${tag}-${Date.now()}.png`;
  await page.screenshot({ path: p, fullPage: false }).catch(() => {});
  proofs.push(p);
}

(async () => {
  const ctx = await chromium.launchPersistentContext(PROFILE, {
    headless: true, args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
    viewport: { width: 1366, height: 900 }, locale: 'en-US', timezoneId: 'America/Los_Angeles',
  });
  const page = ctx.pages()[0] || (await ctx.newPage());
  const report: any = { ts: new Date().toISOString(), rounds: [] };
  const proofs: string[] = [];
  const target = 'https://labs.google/fx/tools/flow';

  for (let round = 1; round <= 2; round++) {
    const r: any = { round, steps: [] };
    await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(8000);
    let st = await classify(page);
    await shoot(page, `r${round}-land`, proofs);
    r.steps.push({ step: 'land', ...st });
    if (!st.authWall) { r.result = 'app-reached'; report.rounds.push(r); break; }

    // Step: click the account entry on the chooser
    if (st.kind === 'chooser') {
      const clicked = await page.evaluate(() => {
        const cands = [...document.querySelectorAll('[data-identifier], li[role="link"], div[role="link"]')] as HTMLElement[];
        const el = cands.find(e => e.offsetParent && /@/.test(e.textContent || ''));
        if (!el) return false; el.click(); return true;
      }).catch(() => false);
      r.steps.push({ step: 'click-account-entry', clicked });
      await page.waitForTimeout(9000);
      st = await classify(page);
      await shoot(page, `r${round}-after-click`, proofs);
      r.steps.push({ step: 'after-click', ...st });
    }

    // Step: if on confirmidentifier ("Verify it's you" with Next button, no password yet) — press Next once.
    if (st.kind === 'verify-or-password' && st.passwordField === 0) {
      const next = page.locator('button:has-text("Next"), #identifierNext button, [jsname] button:has-text("Next")').first();
      if (await next.count().catch(() => 0)) {
        await next.click({ timeout: 8000 }).catch(() => {});
        await page.waitForTimeout(9000);
        st = await classify(page);
        await shoot(page, `r${round}-after-next`, proofs);
        r.steps.push({ step: 'after-next', ...st });
      }
    }

    if (!st.authWall) {
      // landed back in the app — verify Flow composer actually loads
      await page.waitForTimeout(5000);
      const app = await page.evaluate(() => {
        const txt = (document.body.innerText || '').slice(0, 3000);
        return { newProj: /New project/i.test(txt), fields: [...document.querySelectorAll('[contenteditable="true"], textarea')].filter(e => (e as HTMLElement).offsetParent).length };
      }).catch(() => null);
      r.result = 'app-reached'; r.app = app;
      await shoot(page, `r${round}-app`, proofs);
      report.rounds.push(r);
      break;
    }
    r.result = st.passwordField > 0 ? 'password-challenge' : `still-${st.kind}`;
    report.rounds.push(r);
    if (r.result === 'password-challenge') break; // hard stop per policy
  }
  report.proofs = proofs;
  await ctx.close();
  fs.writeFileSync(`${OUT}/recovery-report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
})();
