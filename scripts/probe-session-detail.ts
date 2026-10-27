#!/usr/bin/env tsx
// Inspect labs session JSON (masked) + test NotebookLM reachability, on a given profile.
import { chromium } from 'playwright';
const PROFILE = process.env.LABGOOGLE_PROFILE || '/root/.openclaw/workspace/google-flow-vps-profile-v2';
function mask(s: string) { return s.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+/g, 'MASKED@EMAIL').replace(/"(accessToken|refreshToken|id_token|token)"\s*:\s*"[^"]+"/g, '"$1":"MASKED"'); }
(async () => {
  const ctx = await chromium.launchPersistentContext(PROFILE, {
    headless: true, args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
    viewport: { width: 1366, height: 900 }, locale: 'en-US', timezoneId: 'America/Los_Angeles',
  });
  const page = ctx.pages()[0] || (await ctx.newPage());
  const out: any = { profile: PROFILE.split('/').pop() };
  try {
    const r = await ctx.request.get('https://labs.google/fx/api/auth/session');
    out.sessionStatus = r.status();
    out.sessionMasked = mask(await r.text()).slice(0, 800);
  } catch (e: any) { out.sessionError = String(e?.message || e); }
  try {
    await page.goto('https://notebooklm.google.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(10000);
    out.nlmUrl = page.url().slice(0, 90);
    out.nlmAuthWall = /accounts\.google\.com/.test(page.url());
    out.nlmSnippet = mask(String(await page.evaluate(`document.body.innerText.replace(/\\s+/g,' ').slice(0,200)`).catch(()=>'')));
  } catch (e: any) { out.nlmError = String(e?.message || e); }
  console.log(JSON.stringify(out, null, 1));
  await ctx.close();
})();
