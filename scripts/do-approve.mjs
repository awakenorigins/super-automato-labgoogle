import { chromium } from 'playwright';

const CDP = process.env.LABGOOGLE_CDP || 'http://127.0.0.1:18899';
const browser = await chromium.connectOverCDP(CDP);
const ctx = browser.contexts()[0];
const pages = ctx.pages();
let page = pages.find(p => p.url().includes('/flow/project/')) || pages[0];
console.log('URL:', page.url());

// Locate the exact "Approve" label (not "do not ask again"), get its onclick ancestor, scroll into view, click it.
const result = await page.evaluate(() => {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
  let n, target = null;
  while ((n = walker.nextNode())) {
    const txt = (n.textContent || '').trim();
    if (txt === 'Approve') {
      // find ancestor with onclick
      let anc = n;
      for (let i=0;i<6 && anc;i++){ if (anc.onclick) { target = anc; break; } anc = anc.parentElement; }
      if (target) break;
    }
  }
  if (!target) return { ok:false, reason:'no Approve onclick ancestor found' };
  target.scrollIntoView({block:'center', inline:'center'});
  return { ok:true, scrolled:true };
});
console.log('scroll result:', JSON.stringify(result));
if (!result.ok) { await browser.close(); process.exit(2); }

await page.waitForTimeout(600);

// Re-query rect after scroll, then do a real Playwright click on the onclick ancestor via a bound handle.
const clickRes = await page.evaluate(() => {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
  let n, label=null;
  while ((n = walker.nextNode())) { if ((n.textContent||'').trim()==='Approve'){ label=n; break; } }
  if (!label) return {ok:false, reason:'label gone (maybe already approved)'};
  let anc=label; for(let i=0;i<6&&anc;i++){ if(anc.onclick){break;} anc=anc.parentElement; }
  if(!anc||!anc.onclick) anc=label.parentElement;
  const r = anc.getBoundingClientRect();
  return {ok:true, cx:Math.round(r.x+r.width/2), cy:Math.round(r.y+r.height/2), y:Math.round(r.y)};
});
console.log('post-scroll rect:', JSON.stringify(clickRes));
if (!clickRes.ok) { console.log('LABEL GONE — likely approved already'); await browser.close(); process.exit(0); }

// dispatch a real click sequence at the on-screen coords
await page.mouse.move(clickRes.cx, clickRes.cy);
await page.waitForTimeout(150);
await page.mouse.down();
await page.waitForTimeout(60);
await page.mouse.up();
console.log('clicked at', clickRes.cx, clickRes.cy);

await page.waitForTimeout(2500);
// verify: is the Approve label gone now?
const gone = await page.evaluate(() => {
  const els = [...document.querySelectorAll('div,button,span,p')];
  return !els.some(e => (e.textContent||'').trim()==='Approve' && e.getBoundingClientRect().height>0);
});
console.log('APPROVE_GONE_AFTER_CLICK:', gone);
const shot = 'out/vidcdp/do-approve-' + Date.now() + '.png';
await page.screenshot({ path: shot }).catch(()=>{});
console.log('shot:', shot);
await browser.close();
