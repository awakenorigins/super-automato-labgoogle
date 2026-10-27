#!/usr/bin/env tsx
// For a profile: read labs session token, validate via Google tokeninfo (expiry/scopes),
// and try one ImageFX call. NEVER prints the token itself.
import { chromium } from 'playwright';
import * as fs from 'fs';
const PROFILE = process.env.P || '/root/.openclaw/workspace/google-flow-vps-profile-v2';
const OUT = '/root/.openclaw/workspace/AUTOMATION-LABGOOGLE/out';
(async () => {
  const report: any = { profile: PROFILE.split('/').pop() };
  const ctx = await chromium.launchPersistentContext(PROFILE, {
    headless: true, args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
    viewport: { width: 1366, height: 900 }, locale: 'en-US', timezoneId: 'America/Los_Angeles',
  });
  try {
    const r = await ctx.request.get('https://labs.google/fx/api/auth/session');
    report.sessionStatus = r.status();
    const j = await r.json().catch(() => null as any);
    const token = j?.access_token || '';
    report.hasToken = !!token; report.tokenLen = token.length; report.sessionExpires = j?.expires || null; report.sessionError = j?.error || null;
    if (token) {
      const ti = await ctx.request.get(`https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${encodeURIComponent(token)}`);
      report.tokeninfoStatus = ti.status();
      const tj = await ti.json().catch(() => null as any);
      if (tj) report.tokeninfo = { expires_in: tj.expires_in || null, aud_suffix: (tj.aud || '').slice(-30), scopeCount: (tj.scope || '').split(' ').length, error: tj.error_description || tj.error || null };
      const resp = await ctx.request.post('https://aisandbox-pa.googleapis.com/v1:runImageFx', {
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, Origin: 'https://labs.google', Referer: 'https://labs.google/' },
        data: { userInput: { candidatesCount: 1, prompts: ['watercolor robot with red balloon in sunny park'], seed: null }, clientContext: { sessionId: ';' + Date.now(), tool: 'IMAGE_FX' }, modelInput: { modelNameType: 'IMAGEN_3_1' }, aspectRatio: 'IMAGE_ASPECT_RATIO_LANDSCAPE' },
        timeout: 120000,
      });
      report.imagefxStatus = resp.status();
      if (resp.ok()) {
        const jj = await resp.json().catch(() => null as any);
        const imgs = (jj?.imagePanels || []).flatMap((p: any) => p.generatedImages || []);
        report.images = imgs.length;
        if (imgs[0]?.encodedImage) { fs.writeFileSync(`${OUT}/probe-tok-img.png`, Buffer.from(imgs[0].encodedImage, 'base64')); report.saved = `${OUT}/probe-tok-img.png`; }
      } else { report.imagefxErr = (await resp.text()).slice(0, 200); }
    }
  } catch (e: any) { report.error = String(e?.message || e).slice(0, 300); }
  console.log(JSON.stringify(report, null, 1));
  await ctx.close();
})();
