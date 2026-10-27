#!/usr/bin/env tsx
// Re-auth labs.google using the live Google session in yt-forever-profile,
// then export google+labs cookies and inject into google-flow-vps-profile-v2.
// NEVER prints cookie values. Masked output only.
import { chromium } from 'playwright';
import * as fs from 'fs';
const YT_PROFILE = '/root/.openclaw/workspace/youtube-cli/yt-forever-profile';
const V2_PROFILE = '/root/.openclaw/workspace/google-flow-vps-profile-v2';
const OUT = '/root/.openclaw/workspace/AUTOMATION-LABGOOGLE/out';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36';
function mask(s: string) { return s.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+/g, 'MASKED@EMAIL'); }
(async () => {
  const report: any = { steps: [] };
  // Phase 1: yt profile -> labs sign-in
  const ctx = await chromium.launchPersistentContext(YT_PROFILE, {
    headless: false, userAgent: UA,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-blink-features=AutomationControlled'],
    viewport: { width: 1366, height: 900 },
  });
  let state: any = null;
  try {
    const page = ctx.pages()[0] || (await ctx.newPage());
    const shot = async (t: string) => { const p = `${OUT}/reauth-${t}-${Date.now()}.png`; await page.screenshot({ path: p }).catch(()=>{}); return p; };
    await page.goto('https://labs.google/fx/tools/flow', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(10000);
    report.steps.push({ step: 'open-flow', url: mask(page.url()).slice(0, 110), shot: await shot('open') });

    const sess = async () => { try { const r = await ctx.request.get('https://labs.google/fx/api/auth/session'); const t = await r.text(); return /"email"/.test(t) && !/ACCESS_TOKEN_REFRESH_NEEDED|RefreshAccessTokenError/i.test(t); } catch { return false; } };
    let ok = await sess();
    report.steps.push({ step: 'session-initial', ok });

    for (let round = 0; round < 5 && !ok; round++) {
      const u = page.url();
      if (/accounts\.google\.com/.test(u)) {
        // account chooser or consent
        const acct = page.locator('[data-identifier], li[role="link"], div[role="link"]').first();
        const cont = page.locator('button:has-text("Continue"), #submit_approve_access, button:has-text("Next"), input[type="submit"]').first();
        if (await acct.count().catch(()=>0)) { await acct.click({ timeout: 8000 }).catch(()=>{}); }
        else if (await cont.count().catch(()=>0)) { await cont.click({ timeout: 8000 }).catch(()=>{}); }
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
      } else { await page.waitForTimeout(6000); }
      ok = await sess();
      report.steps.push({ step: `round-${round}`, url: mask(page.url()).slice(0, 110), ok, shot: await shot(`r${round}`) });
    }
    report.labsSignedIn = ok;
    if (ok) {
      await page.goto('https://labs.google/fx/tools/flow', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(()=>{});
      await page.waitForTimeout(10000);
      report.finalUrl = mask(page.url()).slice(0, 110);
      report.finalShot = await shot('final');
      state = await ctx.storageState();
    }
  } finally { await ctx.close(); }

  // Phase 2: inject into v2 profile
  if (state) {
    const keep = state.cookies.filter((c: any) => /google|youtube/.test(c.domain));
    report.cookiesToInject = keep.length;
    const ctx2 = await chromium.launchPersistentContext(V2_PROFILE, {
      headless: true, args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
      viewport: { width: 1366, height: 900 }, locale: 'en-US', timezoneId: 'America/Los_Angeles',
    });
    try {
      await ctx2.addCookies(keep);
      const page2 = ctx2.pages()[0] || (await ctx2.newPage());
      await page2.goto('https://labs.google/fx/tools/flow', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page2.waitForTimeout(12000);
      report.v2Url = mask(page2.url()).slice(0, 110);
      const r = await ctx2.request.get('https://labs.google/fx/api/auth/session');
      const t = await r.text();
      report.v2SignedIn = /"email"/.test(t) && !/RefreshAccessTokenError|ACCESS_TOKEN_REFRESH_NEEDED/i.test(t);
      const p = `${OUT}/reauth-v2-final-${Date.now()}.png`;
      await page2.screenshot({ path: p }).catch(()=>{});
      report.v2Shot = p;
      await ctx2.storageState({ path: '/root/.openclaw/workspace/google-flow-vps-storage-state-v2.json' }).catch(()=>{});
    } finally { await ctx2.close(); }
  }
  fs.writeFileSync(`${OUT}/reauth-report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 1));
})();
