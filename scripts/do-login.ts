#!/usr/bin/env tsx
/**
 * do-login.ts — Sign into Google account via persistent Chromium profile (headful under Xvfb).
 *
 * Credential source: process.env.GLOGIN_PW (NEVER hardcoded, NEVER logged).
 *
 * Usage:
 *   GLOGIN_PW='...' xvfb-run -a npx tsx scripts/do-login.ts
 */
import { chromium } from 'playwright';
import * as fs from 'fs';

const PROFILE = process.env.LABGOOGLE_PROFILE || '/root/.openclaw/workspace/google-flow-vps-profile-v2';
const OUT = '/root/.openclaw/workspace/AUTOMATION-LABGOOGLE/out';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36';
const PW = process.env.GLOGIN_PW || '';
const EMAIL = process.env.GLOGIN_EMAIL || '';

function mask(s: string): string {
  return s.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+/g, 'MASKED@EMAIL');
}

if (!PW) { console.error('GLOGIN_PW env not set'); process.exit(2); }
if (!EMAIL) { console.error('GLOGIN_EMAIL env not set'); process.exit(2); }

fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const report: any = { steps: [], ts: new Date().toISOString() };

  const ctx = await chromium.launchPersistentContext(PROFILE, {
    headless: false,
    userAgent: UA,
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
      '--window-size=1366,900',
    ],
    viewport: { width: 1366, height: 900 },
    locale: 'en-US',
    timezoneId: 'America/Los_Angeles',
  });

  try {
    const page = ctx.pages()[0] || await ctx.newPage();
    const shot = async (tag: string) => {
      const p = `${OUT}/login-${tag}-${Date.now()}.png`;
      await page.screenshot({ path: p, fullPage: true }).catch(() => {});
      return p;
    };
    const pageText = async () => (await page.evaluate(() => document.body.innerText || '').catch(() => '')).slice(0, 2000);

    // ── Step 1: Navigate to accounts ──
    await page.goto('https://accounts.google.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(5000);
    report.steps.push({ step: 'open-accounts', url: mask(page.url()).slice(0, 180), shot: await shot('s1-accounts') });

    // ── Step 2: Handle "Verify that it's you" / confirmidentifier ──
    // Google shows this when cookies exist but session expired: shows email + "Next" button
    let txt = await pageText();
    if (/Verify that it.s you|confirm.*identifier|Please sign in again/i.test(txt)) {
      // Click "Next" to proceed to password challenge
      const nextBtn = page.locator('button:has-text("Next"), #identifierNext button').first();
      if (await nextBtn.isVisible().catch(() => false)) {
        await nextBtn.click({ timeout: 8000 }).catch(() => {});
        await page.waitForTimeout(6000);
        report.steps.push({ step: 'confirm-identifier-next', url: mask(page.url()).slice(0, 180), shot: await shot('s2-confirm-next') });
      }
    }

    // ── Step 3: Account chooser — click our account or "Use another account" ──
    if (/accountchooser|AccountChooser/i.test(page.url())) {
      const accountRow = page.locator(`[data-identifier="${EMAIL}"], [data-email="${EMAIL}"]`).first();
      const useAnother = page.locator('[data-identifier=""], li:has-text("Use another account"), div[role="link"]:has-text("Use another account")').first();
      if (await accountRow.count().catch(() => 0)) {
        await accountRow.click({ timeout: 8000 }).catch(() => {});
        await page.waitForTimeout(5000);
        report.steps.push({ step: 'chooser-clicked-account', url: mask(page.url()).slice(0, 180), shot: await shot('s3-chooser') });
      } else if (await useAnother.count().catch(() => 0)) {
        await useAnother.click({ timeout: 8000 }).catch(() => {});
        await page.waitForTimeout(5000);
        report.steps.push({ step: 'chooser-use-another', url: mask(page.url()).slice(0, 180), shot: await shot('s3-use-another') });
      }
    }

    // ── Step 4: Email identifier page ──
    const emailInput = page.locator('input[type="email"], input[name="identifier"]').first();
    if (await emailInput.isVisible().catch(() => false)) {
      await emailInput.click({ timeout: 5000 }).catch(() => {});
      await emailInput.fill(EMAIL);
      await page.waitForTimeout(500);
      const nextBtn = page.locator('#identifierNext button, button:has-text("Next")').first();
      if (await nextBtn.count().catch(() => 0)) {
        await nextBtn.click({ timeout: 8000 }).catch(() => {});
      } else {
        await page.keyboard.press('Enter');
      }
      await page.waitForTimeout(6000);
      report.steps.push({ step: 'email-entered', url: mask(page.url()).slice(0, 180), shot: await shot('s4-email') });
    }

    // ── Step 5: Password page ──
    // Try up to 3 times with increasing waits (Google loads password field with JS delay)
    let pwEntered = false;
    for (let attempt = 0; attempt < 3 && !pwEntered; attempt++) {
      if (attempt > 0) await page.waitForTimeout(3000);
      const pwInput = page.locator('input[type="password"], input[name="Passwd"]').first();
      if (await pwInput.isVisible().catch(() => false)) {
        await pwInput.click({ timeout: 5000 }).catch(() => {});
        // Type character by character with small delay to avoid detection
        await pwInput.fill(PW);
        await page.waitForTimeout(800);
        const nextBtn = page.locator('#passwordNext button, button:has-text("Next"), button:has-text("Sign in")').first();
        if (await nextBtn.count().catch(() => 0)) {
          await nextBtn.click({ timeout: 8000 }).catch(() => {});
        } else {
          await page.keyboard.press('Enter');
        }
        pwEntered = true;
        await page.waitForTimeout(8000);
        report.steps.push({ step: 'password-entered', url: mask(page.url()).slice(0, 180), shot: await shot('s5-pw') });
      }
    }

    if (!pwEntered) {
      // Maybe the confirm-identifier "Next" led directly to a different challenge
      txt = await pageText();
      report.steps.push({ step: 'no-password-field-found', url: mask(page.url()).slice(0, 180), shot: await shot('s5-no-pw'), text: mask(txt).slice(0, 500) });
    }

    // ── Step 6: 2FA check ──
    if (pwEntered) {
      txt = await pageText();
      const u = page.url();
      const is2FA = /2-Step|verification|verify.*phone|enter.*code|security key|authenticator|challenge\/totp|challenge\/ipp|challenge\/sk|signinchallenge/i.test(txt + u);
      if (is2FA) {
        report.needs2FA = true;
        report.steps.push({ step: '2FA-REQUIRED', url: mask(u).slice(0, 180), shot: await shot('s6-2fa'), text: mask(txt).slice(0, 500) });
        report.loginResult = 'BLOCKED-2FA';
        fs.writeFileSync(`${OUT}/audit6-login.json`, JSON.stringify(report, null, 2));
        console.log(JSON.stringify(report, null, 2));
        await ctx.close();
        process.exit(3);
      }

      // Wrong password check
      const wrongPw = /Wrong password|incorrect|couldn.t sign you in/i.test(txt);
      if (wrongPw) {
        report.steps.push({ step: 'WRONG-PASSWORD', url: mask(u).slice(0, 180), shot: await shot('s6-wrong-pw'), text: mask(txt).slice(0, 400) });
        report.loginResult = 'WRONG-PASSWORD';
        fs.writeFileSync(`${OUT}/audit6-login.json`, JSON.stringify(report, null, 2));
        console.log(JSON.stringify(report, null, 2));
        await ctx.close();
        process.exit(4);
      }

      // Dismiss interstitials (passkey, recovery, protect account, etc.)
      for (let i = 0; i < 5; i++) {
        const notNow = page.locator('button:has-text("Not now"), button:has-text("Skip"), button:has-text("No thanks"), button:has-text("Remind me later"), a:has-text("Not now"), button:has-text("I\'ll do it later")').first();
        if (await notNow.isVisible().catch(() => false)) {
          await notNow.click({ timeout: 5000 }).catch(() => {});
          await page.waitForTimeout(3000);
          report.steps.push({ step: `dismissed-${i}`, url: mask(page.url()).slice(0, 180), shot: await shot(`s6-dismiss-${i}`) });
        } else break;
      }
      // "Done" / "Confirm" button
      const doneBtn = page.locator('button:has-text("Done"), button:has-text("Confirm"), a:has-text("Done")').first();
      if (await doneBtn.isVisible().catch(() => false)) {
        await doneBtn.click({ timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(3000);
      }
    }

    // ── Step 7: Verify — Flow ──
    await page.goto('https://labs.google/fx/tools/flow', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(10000);
    // Handle account chooser if it appears (auto-select our account)
    if (/accounts\.google\.com.*accountchooser/i.test(page.url())) {
      const acct = page.locator(`[data-identifier="${EMAIL}"], [data-email="${EMAIL}"]`).first();
      if (await acct.count().catch(() => 0)) {
        await acct.click({ timeout: 8000 }).catch(() => {});
        await page.waitForTimeout(10000);
      }
    }
    // Dismiss modals
    for (let i = 0; i < 4; i++) {
      const cls = page.locator('[role="dialog"] button[aria-label*="close" i], button:has-text("Got it"), button:has-text("Skip"), button:has-text("Dismiss")').first();
      if (await cls.isVisible().catch(() => false)) { await cls.click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(1500); } else break;
    }
    const flowUrl = page.url();
    const flowAuthWall = /accounts\.google\.com/.test(flowUrl);
    report.steps.push({ step: 'flow-verify', url: mask(flowUrl).slice(0, 180), authWall: flowAuthWall, shot: await shot('s7-flow') });

    let flowSession = false;
    try {
      const r = await ctx.request.get('https://labs.google/fx/api/auth/session');
      const t = await r.text();
      flowSession = /"email"/.test(t) && !/RefreshAccessTokenError|ACCESS_TOKEN_REFRESH_NEEDED/i.test(t);
      report.flowSessionAPI = { signedIn: flowSession, len: t.length };
    } catch (e: any) {
      report.flowSessionAPI = { signedIn: false, error: String(e?.message || e).slice(0, 200) };
    }

    // ── Step 8: Verify — NotebookLM ──
    await page.goto('https://notebooklm.google.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    if (/accounts\.google\.com.*accountchooser/i.test(page.url())) {
      const acct = page.locator(`[data-identifier="${EMAIL}"], [data-email="${EMAIL}"]`).first();
      if (await acct.count().catch(() => 0)) { await acct.click({ timeout: 8000 }).catch(() => {}); await page.waitForTimeout(8000); }
    }
    const nlmUrl = page.url();
    const nlmOk = !/accounts\.google\.com|signin/i.test(nlmUrl);
    report.steps.push({ step: 'nlm-verify', url: mask(nlmUrl).slice(0, 180), ok: nlmOk, shot: await shot('s8-nlm') });

    // ── Step 9: Verify — ImageFX ──
    await page.goto('https://labs.google/fx/tools/image-fx', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    if (/accounts\.google\.com.*accountchooser/i.test(page.url())) {
      const acct = page.locator(`[data-identifier="${EMAIL}"], [data-email="${EMAIL}"]`).first();
      if (await acct.count().catch(() => 0)) { await acct.click({ timeout: 8000 }).catch(() => {}); await page.waitForTimeout(8000); }
    }
    const ifxUrl = page.url();
    const ifxOk = !/accounts\.google\.com/.test(ifxUrl);
    report.steps.push({ step: 'imagefx-verify', url: mask(ifxUrl).slice(0, 180), ok: ifxOk, shot: await shot('s9-imagefx') });

    // ── Build summary ──
    report.loginResult = pwEntered
      ? (flowSession && !flowAuthWall && nlmOk ? 'OK' : 'PARTIAL')
      : 'NO-PW-ENTERED';
    report.audit = {
      flowUI: !flowAuthWall ? 'PASS' : 'FAIL',
      nlmUI: nlmOk ? 'PASS' : 'FAIL',
      imagefxUI: ifxOk ? 'PASS' : 'FAIL',
      flowSession: flowSession ? 'PASS' : 'FAIL',
    };

    // Save storage state
    try {
      await ctx.storageState({ path: '/root/.openclaw/workspace/google-flow-vps-storage-state-v2.json' });
    } catch {}

  } catch (e: any) {
    report.error = String(e?.message || e).slice(0, 500);
    report.loginResult = 'ERROR';
  } finally {
    await ctx.close().catch(() => {});
  }

  fs.writeFileSync(`${OUT}/audit6-login.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
})();
