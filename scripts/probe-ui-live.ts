#!/usr/bin/env tsx
// probe-ui-live: real UI check on Flow / NotebookLM / ImageFX. Screenshot each. No secrets printed.
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
  const report: any = { ts: new Date().toISOString(), probes: [] };
  const targets = [
    { tag: 'flow', url: 'https://labs.google/fx/tools/flow' },
    { tag: 'nlm', url: 'https://notebooklm.google.com/' },
    { tag: 'imagefx', url: 'https://labs.google/fx/tools/image-fx' },
  ];
  for (const t of targets) {
    try {
      await page.goto(t.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(9000);
      const url = page.url();
      const authWall = /accounts\.google\.com/.test(url);
      const state = await page.evaluate(() => {
        const txt = (document.body.innerText || '').slice(0, 4000);
        const ce = [...document.querySelectorAll('[contenteditable="true"], textarea')].filter(e => (e as HTMLElement).offsetParent).length;
        const newProj = /New project/i.test(txt);
        const notebooks = document.querySelectorAll('project-button, a[href*="/notebook/"]').length;
        const signedOut = /Signed out|Choose an account|Verify it.s you|signin/i.test(txt);
        return { editableFields: ce, newProj, notebooks, signedOutText: signedOut, head: txt.slice(0, 500).replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+/g, 'MASKED@EMAIL') };
      }).catch(() => null);
      const shot = `${OUT}/uilive-${t.tag}-${Date.now()}.png`;
      await page.screenshot({ path: shot, fullPage: false });
      report.probes.push({ tag: t.tag, requested: t.url, landed: url.replace(/[?#].*$/, ''), authWall, state, shot });
    } catch (e: any) {
      report.probes.push({ tag: t.tag, error: String(e?.message || e).slice(0, 200) });
    }
  }
  await ctx.close();
  fs.writeFileSync(`${OUT}/uilive-report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
})();
