import { chromium } from 'playwright';
import * as fs from 'fs';
const PROJECT = process.argv[2] || 'https://labs.google/fx/tools/flow/project/8df52104-3632-4522-a75d-1ce23d82e8bc';
const OUT = '/root/.openclaw/workspace/AUTOMATION-LABGOOGLE/out';
const MAXWAIT = Number(process.argv[3] || 900000); // 15 min
(async () => {
  const ctx = await chromium.launchPersistentContext('/root/.openclaw/workspace/google-flow-vps-profile', {
    headless: true, args: ['--no-sandbox'], viewport: { width: 1366, height: 900 },
    locale: 'en-US', timezoneId: 'America/Los_Angeles', acceptDownloads: true,
  });
  const p = ctx.pages()[0] || await ctx.newPage();
  await p.goto(PROJECT, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(8000);
  const start = Date.now();
  let url = '';
  while (Date.now() - start < MAXWAIT) {
    const st = await p.evaluate(() => {
      const vids = [...document.querySelectorAll('video')] as any[];
      const real = vids.map(v => v.src || v.currentSrc || '').find(s => s && s.startsWith('http'));
      const creating = /Creating|Generating|in progress/i.test(document.body.innerText);
      return { real: real || '', creating, n: vids.length };
    });
    if (st.real) { url = st.real; break; }
    process.stderr.write(`[wait] creating=${st.creating} vids=${st.n} t=${Math.round((Date.now()-start)/1000)}s\n`);
    await p.waitForTimeout(10000);
    await p.reload({ waitUntil: 'domcontentloaded' }).catch(()=>{});
    await p.waitForTimeout(6000);
  }
  let saved = '';
  if (url) {
    const shot = `${OUT}/flow-ready-${Date.now()}.png`;
    await p.screenshot({ path: shot });
    try {
      const resp = await p.context().request.get(url);
      if (resp.ok()) { saved = `${OUT}/flow-video-${Date.now()}.mp4`; fs.writeFileSync(saved, Buffer.from(await resp.body())); }
    } catch (e) {}
    if (!saved) {
      // try UI download
      try {
        const vid = p.locator('video').first(); await vid.hover().catch(()=>{});
        const more = p.locator('button[aria-label*="more" i]').first();
        if (await more.count().catch(()=>0)) await more.click().catch(()=>{});
        const dl = p.locator('button:has-text("Download"),[aria-label*="Download" i]').first();
        const [d] = await Promise.all([p.waitForEvent('download',{timeout:60000}).catch(()=>null as any), dl.click().catch(()=>{})]);
        if (d) { saved = `${OUT}/flow-video-${Date.now()}.mp4`; await d.saveAs(saved); }
      } catch {}
    }
  }
  console.log(JSON.stringify({ done: !!url, videoUrl: url.slice(0,80), saved: saved || null }));
  await ctx.close();
})();
