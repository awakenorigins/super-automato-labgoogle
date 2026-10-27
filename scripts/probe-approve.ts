import { chromium } from 'playwright';
const PROFILE = process.env.LABGOOGLE_PROFILE || '/root/.openclaw/workspace/google-flow-vps-profile-v2';
const OUT = '/root/.openclaw/workspace/AUTOMATION-LABGOOGLE/out';
import * as fs from 'fs';
(async () => {
  const ctx = await chromium.launchPersistentContext(PROFILE, {
    headless: true, args: ['--no-sandbox','--disable-dev-shm-usage','--disable-blink-features=AutomationControlled'],
    viewport: { width: 1366, height: 900 }, locale: 'en-US', timezoneId: 'America/Los_Angeles',
  });
  try {
    const page = ctx.pages()[0] || (await ctx.newPage());
    await page.goto('https://labs.google/fx/tools/flow', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const nb = page.locator('button:has-text("New project")').first();
    if (await nb.count().catch(()=>0)) await nb.click({timeout:8000}).catch(()=>{});
    await page.waitForTimeout(10000);
    await page.keyboard.press('Escape').catch(()=>{});
    // type prompt
    const ceRect = await page.evaluate(() => { const ce=[...document.querySelectorAll('[contenteditable="true"]')].find(e=>(e as HTMLElement).offsetParent) as HTMLElement|undefined; if(!ce) return null; ce.focus(); const r=ce.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; });
    if (!ceRect) { console.log('no composer'); return; }
    await page.mouse.click(ceRect.x, ceRect.y); await page.waitForTimeout(800);
    await page.keyboard.insertText('A tiny robot waves hello in a sunny lab, 4 seconds, cute');
    await page.waitForTimeout(1000);
    const btnRect = await page.evaluate(() => { const b=[...document.querySelectorAll('button')].find(x=>/arrow_forward/.test(x.textContent||'') && (x as HTMLElement).offsetParent) as HTMLElement|undefined; if(!b) return null; const r=b.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; });
    if (btnRect) await page.mouse.click(btnRect.x, btnRect.y); else await page.keyboard.press('Enter');
    console.log('submitted, waiting for approval prompt...');
    // wait for Approve to appear
    let approveInfo: any = null;
    for (let i = 0; i < 40; i++) {
      await page.waitForTimeout(5000);
      approveInfo = await page.evaluate(() => {
        const all = [...document.querySelectorAll('*')] as HTMLElement[];
        const hits = all.filter(e => e.childElementCount <= 3 && /^\s*Approve\s*$|^\s*check\s*Approve\s*$/i.test((e.textContent||'').replace(/\s+/g,' ').trim()));
        return hits.map(e => { const r = e.getBoundingClientRect(); return { tag: e.tagName, role: e.getAttribute('role'), cls: (e.className||'').toString().slice(0,60), x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; });
      });
      if (approveInfo && approveInfo.length) break;
    }
    console.log('approve candidates:', JSON.stringify(approveInfo, null, 1));
    await page.screenshot({ path: `${OUT}/probe-approve-1.png` });
    if (approveInfo && approveInfo.length) {
      const t = approveInfo.find((c: any) => c.w > 20 && c.h > 10) || approveInfo[0];
      await page.mouse.click(t.x + t.w/2, t.y + t.h/2);
      console.log('clicked approve at', t.x + t.w/2, t.y + t.h/2);
      await page.waitForTimeout(8000);
      await page.screenshot({ path: `${OUT}/probe-approve-2.png` });
      // poll video up to 9 min
      const start = Date.now();
      let src = '';
      while (Date.now() - start < 540000) {
        const st = await page.evaluate(() => { const v=[...document.querySelectorAll('video')] as HTMLVideoElement[]; return { n: v.length, src: v.map(x=>x.currentSrc||x.src||'').find(Boolean)||'' }; });
        if (st.src) { src = st.src; break; }
        if ((Date.now()-start) % 60000 < 12000) console.log('poll', Math.round((Date.now()-start)/1000), 's vids', st.n);
        await page.waitForTimeout(10000);
      }
      await page.screenshot({ path: `${OUT}/probe-approve-3.png` });
      console.log('videoSrc:', src ? src.slice(0,140) : 'NONE');
      if (src) {
        const fp = `${OUT}/flow-video-${Date.now()}.mp4`;
        let ok = false;
        try {
          if (src.startsWith('http')) { const r = await ctx.request.get(src, { timeout: 180000 }); if (r.ok()) { fs.writeFileSync(fp, Buffer.from(await r.body())); ok = true; } }
          if (!ok) { const b64 = await page.evaluate(async (u: string) => { const r=await fetch(u); const b=await r.blob(); const ab=await b.arrayBuffer(); let bin=''; const a=new Uint8Array(ab); for(let i=0;i<a.length;i++) bin+=String.fromCharCode(a[i]); return btoa(bin); }, src); fs.writeFileSync(fp, Buffer.from(b64,'base64')); ok = true; }
        } catch (e) { console.log('dl-err', String(e).slice(0,150)); }
        console.log('DOWNLOAD:', ok ? fp : 'FAILED');
      }
    }
  } finally { await ctx.close(); }
})();
