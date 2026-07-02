#!/usr/bin/env tsx
// probe-token-health2: is the labs session access_token alive again? (no secrets printed)
import { chromium } from 'playwright';
import * as fs from 'fs';

const PROFILE = process.env.LABGOOGLE_PROFILE || '/root/.openclaw/workspace/google-flow-vps-profile-v2';
const OUT = '/root/.openclaw/workspace/AUTOMATION-LABGOOGLE/out';

(async () => {
  const ctx = await chromium.launchPersistentContext(PROFILE, {
    headless: true, args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
    viewport: { width: 1366, height: 900 }, locale: 'en-US', timezoneId: 'America/Los_Angeles',
  });
  const page = ctx.pages()[0] || (await ctx.newPage());
  await page.goto('https://labs.google/fx/tools/flow', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(5000);
  const report: any = { ts: new Date().toISOString() };
  let token = '', expires = '';
  try {
    const r = await ctx.request.get('https://labs.google/fx/api/auth/session');
    const j = await r.json().catch(() => null as any);
    token = j?.access_token || '';
    expires = j?.expires || '';
    report.session = { status: r.status(), hasEmail: !!j?.user?.email, hasToken: !!token, tokenLen: token.length, expires };
  } catch (e: any) { report.session = { error: String(e?.message || e).slice(0, 150) }; }
  if (token) {
    try {
      const ti = await ctx.request.get(`https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(token)}`);
      const tj = await ti.json().catch(() => null as any);
      report.tokeninfo = { status: ti.status(), aud: tj?.aud ? 'present' : 'absent', scope: (tj?.scope || '').split(' ').length, expires_in: tj?.expires_in, error: tj?.error_description || tj?.error || null };
    } catch (e: any) { report.tokeninfo = { error: String(e?.message || e).slice(0, 150) }; }
    // live minimal runImageFx probe (1 image)
    try {
      const resp = await ctx.request.post('https://aisandbox-pa.googleapis.com/v1:runImageFx', {
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, Origin: 'https://labs.google', Referer: 'https://labs.google/' },
        data: { userInput: { candidatesCount: 1, prompts: ['a red apple on white background'], seed: null }, clientContext: { sessionId: ';' + Date.now(), tool: 'IMAGE_FX' }, modelInput: { modelNameType: 'IMAGEN_3_1' }, aspectRatio: 'IMAGE_ASPECT_RATIO_SQUARE' },
        timeout: 120000,
      });
      const txt = await resp.text();
      report.runImageFx = { status: resp.status(), ok: resp.ok(), bodyHead: resp.ok() ? '(image payload)' : txt.slice(0, 200).replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+/g, 'MASKED@EMAIL') };
      if (resp.ok()) {
        const jj = JSON.parse(txt);
        const imgs = (jj.imagePanels || []).flatMap((p: any) => p.generatedImages || []);
        report.runImageFx.images = imgs.length;
        if (imgs[0]?.encodedImage) {
          const fp = `${OUT}/tokenprobe-image-${Date.now()}.png`;
          fs.writeFileSync(fp, Buffer.from(imgs[0].encodedImage, 'base64'));
          report.runImageFx.saved = fp;
        }
      }
    } catch (e: any) { report.runImageFx = { error: String(e?.message || e).slice(0, 200) }; }
  }
  await ctx.close();
  fs.writeFileSync(`${OUT}/token-health2.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
})();
