import { chromium } from 'playwright';
const CDP = process.env.LABGOOGLE_CDP || 'http://127.0.0.1:18899';
const OUT = '/root/.openclaw/workspace/AUTOMATION-LABGOOGLE/out';
const PROJ = 'https://labs.google/fx/tools/flow/project/c262eb0e-a8a2-4aa3-bd83-99daf38b192c';

(async () => {
  const browser = await chromium.connectOverCDP(CDP, { timeout: 30000 });
  const ctx = browser.contexts()[0];
  let page = ctx.pages().find(p => /flow\/project/.test(p.url())) || ctx.pages()[0];
  await page.goto(PROJ, { waitUntil:'domcontentloaded', timeout:60000 });
  await page.waitForTimeout(8000);
  await page.keyboard.press('Escape').catch(()=>{});

  // Find the tune/sliders icon in the bottom composer (right panel bottom).
  const tune = await page.evaluate(() => {
    const btns=[...document.querySelectorAll('button,[role="button"]')] as HTMLElement[];
    const c=btns.filter(e=>{ const r=e.getBoundingClientRect(); const aria=(e.getAttribute('aria-label')||'').toLowerCase(); const t=(e.textContent||'').toLowerCase();
      return e.offsetParent && r.y>640 && r.width<70 && r.height<70 && (/tune|setting|option|aspect|ratio|model|adjust|slider/.test(aria+t)); });
    if(!c.length) return null;
    c.sort((a,b)=>b.getBoundingClientRect().y-a.getBoundingClientRect().y);
    const b=c[0]; const r=b.getBoundingClientRect();
    return { x:Math.round(r.x+r.width/2), y:Math.round(r.y+r.height/2), aria:b.getAttribute('aria-label'), t:(b.textContent||'').trim() };
  });
  console.log('TUNE', JSON.stringify(tune));
  if (tune) { await page.mouse.click(tune.x, tune.y); await page.waitForTimeout(1800); }
  await page.screenshot({ path:`${OUT}/dtq-composer-popover.png`, fullPage:false });

  const pop = await page.evaluate(() => {
    const body=(document.body.innerText||'');
    const zero=/use\s*0\s*credits|0 credits/i.test(body);
    const opts=[...document.querySelectorAll('button,[role="button"],[role="menuitem"],[role="option"],[role="radio"],div,span')].map((e:any)=>{
      const t=(e.textContent||'').replace(/\s+/g,' ').trim();
      if(!e.offsetParent||!t||t.length>28) return null;
      if(!/image|video|frame|ingredient|nano banana|veo|imagen|1:1|16:9|9:16|4:3|3:4|credit|aspect|model/i.test(t)) return null;
      const r=e.getBoundingClientRect();
      return { t, x:Math.round(r.x), y:Math.round(r.y) };
    }).filter(Boolean).slice(0,40);
    return { zero, opts };
  });
  console.log('POPOVER', JSON.stringify(pop));
  console.log('DONE');
  await browser.close();
})().catch(e=>{ console.error('ERR', e?.message||e); process.exit(1); });
