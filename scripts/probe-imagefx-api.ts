#!/usr/bin/env tsx
// Probe: generate an image via the ImageFX backend API using the labs.google
// session access token from the persistent profile (no UI needed).
import { chromium } from 'playwright';
import * as fs from 'fs';
const PROFILE = process.env.LABGOOGLE_PROFILE || '/root/.openclaw/workspace/google-flow-vps-profile-v2';
const OUT = '/root/.openclaw/workspace/AUTOMATION-LABGOOGLE/out';
(async () => {
  const ctx = await chromium.launchPersistentContext(PROFILE, {
    headless: true, args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
    viewport: { width: 1366, height: 900 }, locale: 'en-US', timezoneId: 'America/Los_Angeles',
  });
  const report: any = {};
  try {
    const r = await ctx.request.get('https://labs.google/fx/api/auth/session');
    const j = await r.json().catch(() => null as any);
    const token = j?.access_token || '';
    report.sessionOk = !!token;
    if (token) {
      const body = {
        userInput: { candidatesCount: 2, prompts: ['A watercolor painting of a small robot holding a red balloon in a sunny park'], seed: null },
        clientContext: { sessionId: ';' + Date.now(), tool: 'IMAGE_FX' },
        modelInput: { modelNameType: 'IMAGEN_3_1' },
        aspectRatio: 'IMAGE_ASPECT_RATIO_LANDSCAPE',
      };
      const resp = await ctx.request.post('https://aisandbox-pa.googleapis.com/v1:runImageFx', {
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, Origin: 'https://labs.google', Referer: 'https://labs.google/' },
        data: body, timeout: 120000,
      });
      report.status = resp.status();
      const txt = await resp.text();
      report.bodyLen = txt.length;
      if (resp.ok()) {
        const jj = JSON.parse(txt);
        const imgs = (jj.imagePanels || []).flatMap((p: any) => p.generatedImages || []);
        report.images = imgs.length;
        imgs.slice(0, 2).forEach((im: any, i: number) => {
          if (im.encodedImage) {
            const fp = `${OUT}/probe-imagefx-${i}.png`;
            fs.writeFileSync(fp, Buffer.from(im.encodedImage, 'base64'));
            report[`saved${i}`] = fp;
          }
        });
      } else {
        report.err = txt.slice(0, 500);
      }
    }
  } catch (e: any) { report.error = String(e?.message || e); }
  console.log(JSON.stringify(report, null, 1));
  await ctx.close();
})();
