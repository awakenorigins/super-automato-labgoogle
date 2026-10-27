#!/usr/bin/env tsx
// Probe: establish labs.google session in the v3 profile (COPY of yt-forever-profile).
// Never prints cookie values. Masked URLs only.
import { chromium } from 'playwright';
import * as fs from 'fs';
const PROFILE = '/root/.openclaw/workspace/google-flow-labgoogle-profile-v3';
const OUT = '/root/.openclaw/workspace/AUTOMATION-LABGOOGLE/out';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36';
function mask(s: string) { return s.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+/g, 'MASKED@EMAIL'); }
(async () => {
  const report: any = { steps: [] };
  const ctx = await chromium.launchPersistentContext(PROFILE, {
    headless: true, userAgent: UA,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-blink-features=AutomationControlled'],
    viewport: { width: 1366, height: 900 },
  });
  try {
    const page = ctx.pages()[0] || (await ctx.newPage());
    const shot = async (t: string) => { const p = `${OUT}/v3probe-${t}-${Date.now()}.png`; await page.screenshot({ path: p }).catch(()=>{}); return p; };
    const sess = async () => { try { const r = await ctx.request.get('https://labs.google/fx/api/auth/session'); const t = await r.text(); return /"email"/.test(t) && !/ACCESS_TOKEN_REFRESH_NEEDED|RefreshAccessTokenError/i.test(t); } catch { return false; } };

    // Step 0: check google.com session state via myaccount redirect
    await page.goto('https://accounts.google.com/ServiceLogin?continue=https://myaccount.google.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    report.steps.push({ step: 'gsession', url: mask(page.url()).slice(0, 120), shot: await shot('gsession') });

    // Step 1: open Flow
    await page.goto('https://labs.google/fx/tools/flow', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(10000);
    report.steps.push({ step: 'flow-open', url: mask(page.url()).slice(0, 120), shot: await shot('flow') });
    let ok = await sess();
    report.steps.push({ step: 'session-initial', ok });

    for (let round = 0; round < 2 && !ok; round++) {
      const u = page.url();
      if (/accounts\.google\.com/.test(u)) {
        const acct = page.locator('[data-identifier], li[role="link"], div[role="link"]').first();
        const cont = page.locator('button:has-text("Continue"), #submit_approve_access, button:has-text("Next"), input[type="submit"]').first();
        if (await acct.count().catch(()=>0)) await acct.click({ timeout: 8000 }).catch(()=>{});
        else if (await cont.count().catch(()=>0)) await cont.click({ timeout: 8000 }).catch(()=>{});
        await page.waitForTimeout(10000);
      } else if (/labs\.google/.test(u)) {
        const signin = page.locator('a:has-text("Sign in"), button:has-text("Sign in"), a[href*="accounts.google.com"]').first();
        if (await signin.count().catch(()=>0)) { await signin.click({ timeout: 8000 }).catch(()=>{}); await page.waitForTimeout(10000); }
        else {
          await page.goto('https://labs.google/fx/api/auth/signin?callbackUrl=%2Ffx%2Ftools%2Fflow', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(()=>{});
          await page.waitForTimeout(6000);
          const g = page.locator('form button, button:has-text("Google")').first();
          if (await g.count().catch(()=>0)) { await g.click({ timeout: 8000 }).catch(()=>{}); await page.waitForTimeout(12000); }
        }
      } else await page.waitForTimeout(6000);
      ok = await sess();
      report.steps.push({ step: `round-${round}`, url: mask(page.url()).slice(0, 120), ok, shot: await shot(`r${round}`) });
    }
    report.labsSignedIn = ok;
    if (ok) {
      await page.goto('https://labs.google/fx/tools/flow', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(()=>{});
      await page.waitForTimeout(12000);
      report.finalUrl = mask(page.url()).slice(0, 120);
      report.finalShot = await shot('final');
      report.composerVisible = await page.evaluate(() => /New project|Create with|Flow/i.test(document.body.innerText || '') && !/Sign in/i.test((document.body.innerText || '').slice(0, 500)));
    }
  } catch (e: any) { report.error = String(e?.message || e); }
  fs.writeFileSync(`${OUT}/v3probe-report.json`, JSON.stringify(report, null, 2));
  console.log(mask(JSON.stringify(report)).slice(0, 2500));
  await ctx.close();
})();
