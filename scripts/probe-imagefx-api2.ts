#!/usr/bin/env tsx
// Probe 2: page-visit first (forces next-auth token refresh), then call ImageFX API.
// Also intercept real API calls the UI makes to learn correct endpoint/auth.
import { chromium } from 'playwright';
import * as fs from 'fs';
const PROFILE = process.env.P || '/root/.openclaw/workspace/google-flow-vps-profile-v2';
const OUT = '/root/.openclaw/workspace/AUTOMATION-LABGOOGLE/out';
function mask(s: string) { return s.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+/g, 'MASKED@EMAIL'); }
(async () => {
  const report: any = { apiCallsSeen: [] };
  const ctx = await chromium.launchPersistentContext(PROFILE, {
    headless: true, args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
    viewport: { width: 1366, height: 900 }, locale: 'en-US', timezoneId: 'America/Los_Angeles',
  });
  try {
    const page = ctx.pages()[0] || (await ctx.newPage());
    // log outgoing API requests (method+url+status only, no headers/bodies)
    page.on('response', (r) => { const u = r.url(); if (/aisandbox|googleapis|\/fx\/api\//.test(u)) report.apiCallsSeen.push(`${r.request().method()} ${u.slice(0, 130)} -> ${r.status()}`); });

    await page.goto('https://labs.google/fx/tools/flow', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(10000);
    report.flowUrl = mask(page.url()).slice(0, 130);
    await page.screenshot({ path: `${OUT}/probe-api2-flow.png` }).catch(()=>{});

    // fetch session AFTER page visit — from PAGE context (browser fetch, not ctx.request)
    const sess = await page.evaluate(async () => {
      const r = await fetch('/fx/api/auth/session'); const j = await r.json().catch(() => null);
      return j ? { hasToken: !!j.access_token, tokenLen: (j.access_token || '').length, expires: j.expires || null } : null;
    }).catch(() => null as any);
    report.pageSession = sess;

    // Try calling the ImageFX backend FROM the page (same origin fetch w/ token)
    const apiTry = await page.evaluate(async () => {
      const r = await fetch('/fx/api/auth/session'); const j = await r.json().catch(() => null);
      const token = j?.access_token || '';
      if (!token) return { err: 'no-token' };
      const body = {
        userInput: { candidatesCount: 1, prompts: ['A watercolor robot holding a red balloon in a sunny park'], seed: null },
        clientContext: { sessionId: ';' + Date.now(), tool: 'IMAGE_FX' },
        modelInput: { modelNameType: 'IMAGEN_3_1' },
        aspectRatio: 'IMAGE_ASPECT_RATIO_LANDSCAPE',
      };
      const resp = await fetch('https://aisandbox-pa.googleapis.com/v1:runImageFx', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body),
      });
      const txt = await resp.text();
      let imgs = 0; let b64: string | null = null;
      try { const jj = JSON.parse(txt); const arr = (jj.imagePanels || []).flatMap((p: any) => p.generatedImages || []); imgs = arr.length; b64 = arr[0]?.encodedImage || null; } catch {}
      return { status: resp.status, len: txt.length, imgs, b64: b64 ? b64.slice(0, 100000000) : null, errSnip: resp.ok ? null : txt.slice(0, 300) };
    }).catch((e) => ({ err: String(e).slice(0, 200) }));
    report.apiTry = { ...apiTry, b64: (apiTry as any)?.b64 ? `<${(apiTry as any).b64.length}ch>` : null };
    if ((apiTry as any)?.b64) fs.writeFileSync(`${OUT}/probe-api2-img.png`, Buffer.from((apiTry as any).b64, 'base64'));
  } catch (e: any) { report.error = String(e?.message || e).slice(0, 300); }
  fs.writeFileSync(`${OUT}/probe-api2-report.json`, JSON.stringify(report, null, 2));
  console.log(mask(JSON.stringify(report, null, 1)).slice(0, 2500));
  await ctx.close();
})();
