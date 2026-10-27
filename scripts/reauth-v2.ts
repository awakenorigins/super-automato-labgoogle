#!/usr/bin/env tsx
/**
 * reauth-v2.ts — Robust headless re-auth for Google Flow (labs.google).
 *
 * Handles the "Verify that it's you" (confirmidentifier) interstitial that
 * Google shows when identity cookies survive but the session token expired.
 * Flow: confirmidentifier -> Next -> password -> dismiss interstitials -> verify Flow.
 *
 * Credentials from env only: GLOGIN_EMAIL, GLOGIN_PW (NEVER hardcoded/logged).
 * Runs headful under Xvfb (no manual VNC needed).
 *
 *   GLOGIN_EMAIL='...' GLOGIN_PW='...' xvfb-run -a npx tsx scripts/reauth-v2.ts
 */
import { chromium, Page } from 'playwright';
import * as fs from 'fs';

const PROFILE = process.env.LABGOOGLE_PROFILE || '/root/.openclaw/workspace/google-flow-vps-profile-v2';
const OUT = '/root/.openclaw/workspace/AUTOMATION-LABGOOGLE/out';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36';
const PW = process.env.GLOGIN_PW || '';
const EMAIL = process.env.GLOGIN_EMAIL || '';
const FLOW = 'https://labs.google/fx/tools/flow';

function mask(s: string) { return s.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+/g, 'MASKED@EMAIL'); }
if (!PW || !EMAIL) { console.error('GLOGIN_EMAIL and GLOGIN_PW env required'); process.exit(2); }
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const report: any = { steps: [], ts: new Date().toISOString(), result: 'UNKNOWN' };
  const ctx = await chromium.launchPersistentContext(PROFILE, {
    headless: false, userAgent: UA, viewport: { width: 1366, height: 900 },
    locale: 'en-US', timezoneId: 'America/Los_Angeles',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-blink-features=AutomationControlled', '--window-size=1366,900'],
  });
  const page: Page = ctx.pages()[0] || await ctx.newPage();
  const shot = async (t: string) => { const p = `${OUT}/reauth-${t}-${Date.now()}.png`; await page.screenshot({ path: p, fullPage: false }).catch(() => {}); return p; };
  const bodyText = async () => (await page.evaluate(() => document.body?.innerText || '').catch(() => '')).slice(0, 1500);
  const log = async (step: string, extra: any = {}) => { report.steps.push({ step, url: mask(page.url()).slice(0, 160), text: mask(await bodyText()).slice(0, 220), shot: await shot(step), ...extra }); };

  const clickNext = async () => {
    const sels = ['#identifierNext button', '#confirmIdentifierNext button', 'button:has-text("Next")', 'button:has-text("Continue")', '[jsname="LgbsSe"]'];
    for (const s of sels) { const b = page.locator(s).first(); if (await b.isVisible().catch(() => false)) { await b.click({ timeout: 6000 }).catch(() => {}); return true; } }
    await page.keyboard.press('Enter').catch(() => {}); return false;
  };

  try {
    // Step 1: land on Flow — if signed in, done. Else it bounces to signin.
    await page.goto(FLOW, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(6000);
    await log('open-flow');
    if (!/accounts\.google\.com/.test(page.url())) {
      report.result = 'ALREADY_SIGNED_IN'; await log('verify-already-in');
      fs.writeFileSync(`${OUT}/reauth-v2.json`, JSON.stringify(report, null, 2));
      console.log(JSON.stringify({ result: report.result }, null, 1)); await ctx.close(); return;
    }

    // Step 2: account chooser -> pick our account
    if (/accountchooser/i.test(page.url())) {
      const row = page.locator(`[data-identifier="${EMAIL}"], [data-email="${EMAIL}"], li:has-text("${EMAIL}")`).first();
      if (await row.count().catch(() => 0)) { await row.click({ timeout: 8000 }).catch(() => {}); await page.waitForTimeout(5000); }
      await log('chooser-picked');
    }

    // Step 3: "Verify that it's you" / confirmidentifier -> Next (repeat up to 3x to advance)
    for (let i = 0; i < 3; i++) {
      const t = await bodyText();
      if (/Verify that it.s you|confirm.*identifier|To help keep your account secure/i.test(t) || /confirmidentifier/i.test(page.url())) {
        await clickNext(); await page.waitForTimeout(5000); await log(`confirm-next-${i}`);
      } else break;
    }

    // Step 4: email input if shown
    const emailIn = page.locator('input[type="email"], input[name="identifier"]').first();
    if (await emailIn.isVisible().catch(() => false)) {
      await emailIn.fill(EMAIL); await page.waitForTimeout(500); await clickNext(); await page.waitForTimeout(6000); await log('email-entered');
    }

    // Step 5: password (retry — JS-delayed field)
    let pwOk = false;
    for (let a = 0; a < 4 && !pwOk; a++) {
      if (a) await page.waitForTimeout(3500);
      const pwIn = page.locator('input[type="password"], input[name="Passwd"]').first();
      if (await pwIn.isVisible().catch(() => false)) {
        await pwIn.click({ timeout: 5000 }).catch(() => {}); await pwIn.fill(PW); await page.waitForTimeout(800);
        await clickNext(); pwOk = true; await page.waitForTimeout(8000); await log('password-entered');
      }
    }
    if (!pwOk) { report.result = 'NO_PASSWORD_FIELD'; await log('no-pw-field'); }

    // Step 6: challenge detection
    const txt6 = await bodyText(); const u6 = page.url();
    if (/2-Step|verification|verify.*phone|enter.*code|security key|authenticator|challenge\/(totp|ipp|sk)|signinchallenge/i.test(txt6 + u6)) {
      report.result = 'BLOCKED_2FA'; report.needs2FA = true; await log('2FA-required');
      fs.writeFileSync(`${OUT}/reauth-v2.json`, JSON.stringify(report, null, 2));
      console.log(JSON.stringify({ result: report.result }, null, 1)); await ctx.close(); return;
    }
    if (/Wrong password|incorrect password|couldn.t sign you in/i.test(txt6)) {
      report.result = 'WRONG_PASSWORD'; await log('wrong-pw');
      fs.writeFileSync(`${OUT}/reauth-v2.json`, JSON.stringify(report, null, 2));
      console.log(JSON.stringify({ result: report.result }, null, 1)); await ctx.close(); return;
    }

    // Step 7: dismiss "protect account / passkey / recovery" interstitials
    for (let i = 0; i < 6; i++) {
      const nn = page.locator('button:has-text("Not now"), button:has-text("Skip"), button:has-text("No thanks"), button:has-text("Remind me later"), a:has-text("Not now")').first();
      if (await nn.isVisible().catch(() => false)) { await nn.click({ timeout: 5000 }).catch(() => {}); await page.waitForTimeout(2500); } else break;
    }

    // Step 8: verify Flow loads signed-in
    await page.goto(FLOW, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(9000);
    // handle chooser re-appear
    if (/accountchooser/i.test(page.url())) {
      const row = page.locator(`[data-identifier="${EMAIL}"], [data-email="${EMAIL}"]`).first();
      if (await row.count().catch(() => 0)) { await row.click({ timeout: 6000 }).catch(() => {}); await page.waitForTimeout(6000); }
    }
    await log('verify-flow');
    report.result = /accounts\.google\.com/.test(page.url()) ? 'STILL_SIGNED_OUT' : 'SIGNED_IN_OK';
  } catch (e: any) { report.result = 'ERROR'; report.error = String(e?.message || e); }

  fs.writeFileSync(`${OUT}/reauth-v2.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ result: report.result, steps: report.steps.map((s: any) => s.step) }, null, 1));
  await ctx.close();
})();
