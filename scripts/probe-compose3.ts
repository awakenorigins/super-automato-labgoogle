import { chromium } from 'playwright';
const PROFILE = process.env.LABGOOGLE_PROFILE || '/root/.openclaw/workspace/google-flow-vps-profile-v2';
const OUT = '/root/.openclaw/workspace/AUTOMATION-LABGOOGLE/out';
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
    if (await nb.count().catch(()=>0)) { await nb.click({timeout:8000}).catch(()=>{}); }
    await page.waitForTimeout(10000);
    await page.keyboard.press('Escape').catch(()=>{});

    // focus contenteditable directly
    const rect = await page.evaluate(() => {
      const ce = [...document.querySelectorAll('[contenteditable="true"]')].find(e => (e as HTMLElement).offsetParent) as HTMLElement | undefined;
      if (!ce) return null;
      ce.focus();
      const r = ce.getBoundingClientRect();
      return { x: r.x + r.width/2, y: r.y + r.height/2 };
    });
    console.log('ce rect', JSON.stringify(rect));
    if (rect) await page.mouse.click(rect.x, rect.y);
    await page.waitForTimeout(1000);
    await page.keyboard.insertText('A tiny robot waves hello in a sunny lab, 4 seconds, cute');
    await page.waitForTimeout(1500);
    const typedCheck = await page.evaluate(() => {
      const ce = [...document.querySelectorAll('[contenteditable="true"]')].find(e => (e as HTMLElement).offsetParent) as HTMLElement | undefined;
      return ce ? (ce.innerText || '').slice(0, 100) : null;
    });
    console.log('typedCheck:', JSON.stringify(typedCheck));
    await page.screenshot({ path: `${OUT}/probe3-typed.png` });

    // click the arrow_forward Create submit button by evaluated rect
    const btnRect = await page.evaluate(() => {
      const btns = [...document.querySelectorAll('button')] as HTMLElement[];
      const b = btns.find(x => /arrow_forward/.test(x.textContent || '') && /Create/.test(x.textContent || '') && x.offsetParent);
      if (!b) return null;
      const r = b.getBoundingClientRect();
      return { x: r.x + r.width/2, y: r.y + r.height/2, t: (b.textContent||'').slice(0,40) };
    });
    console.log('btnRect:', JSON.stringify(btnRect));
    if (btnRect) await page.mouse.click(btnRect.x, btnRect.y); else await page.keyboard.press('Enter');
    await page.waitForTimeout(10000);
    await page.screenshot({ path: `${OUT}/probe3-submitted.png` });

    // poll up to 8 min for video
    const start = Date.now();
    let found = '';
    while (Date.now() - start < 480000) {
      const st = await page.evaluate(() => {
        const vids = [...document.querySelectorAll('video')] as HTMLVideoElement[];
        const src = vids.map(v => v.currentSrc || v.src || '').find(Boolean) || '';
        return { src, n: vids.length, body: (document.body.innerText||'').replace(/\s+/g,' ').slice(0,300) };
      });
      if (st.src) { found = st.src; console.log('VIDEO:', st.src.slice(0,120), 'count', st.n); break; }
      console.log('poll', Math.round((Date.now()-start)/1000)+'s', 'vids', st.n, '|', st.body.slice(0,160));
      await page.waitForTimeout(15000);
    }
    await page.screenshot({ path: `${OUT}/probe3-done.png` });
    if (found) {
      const fp = `${OUT}/flow-video-${Date.now()}.mp4`;
      let ok = false;
      try {
        if (found.startsWith('http')) { const r = await ctx.request.get(found, { timeout: 120000 }); if (r.ok()) { require('fs').writeFileSync(fp, Buffer.from(await r.body())); ok = true; } }
        if (!ok) {
          const b64 = await page.evaluate(async (u) => { const r = await fetch(u); const b = await r.blob(); const ab = await b.arrayBuffer(); let bin=''; const arr=new Uint8Array(ab); for (let i=0;i<arr.length;i++) bin+=String.fromCharCode(arr[i]); return btoa(bin); }, found);
          require('fs').writeFileSync(fp, Buffer.from(b64, 'base64')); ok = true;
        }
      } catch (e) { console.log('dl-err', String(e).slice(0,150)); }
      console.log('DOWNLOAD:', ok ? fp : 'FAILED');
    } else { console.log('NO VIDEO within timeout'); }
  } finally { await ctx.close(); }
})();
