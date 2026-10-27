import { chromium } from 'playwright';

const CDP = process.env.LABGOOGLE_CDP || 'http://127.0.0.1:18899';
const PROJ = 'https://labs.google/fx/tools/flow/project/c262eb0e-a8a2-4aa3-bd83-99daf38b192c';

(async () => {
  const browser = await chromium.connectOverCDP(CDP, { timeout: 30000 });
  const ctx = browser.contexts()[0];
  const page = ctx.pages().find(p => !/^chrome:|^devtools:/.test(p.url())) || ctx.pages()[0] || await ctx.newPage();
  await page.goto(PROJ, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(9000);
  // dismiss modals
  await page.keyboard.press('Escape').catch(()=>{});
  await page.waitForTimeout(500);

  const info = await page.evaluate(() => {
    const out: any = { url: location.href, title: document.title };
    const bodyText = (document.body.innerText || '');
    out.hasCredits = /credit/i.test(bodyText);
    out.mentions0credits = /use\s*0\s*credits|0 credits/i.test(bodyText);
    out.editables = [...document.querySelectorAll('[contenteditable="true"],textarea')].map((e: any) => {
      const r = e.getBoundingClientRect();
      return { tag: e.tagName, aria: e.getAttribute('aria-label'), ph: e.getAttribute('data-placeholder')||e.placeholder||'', x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), vis: !!e.offsetParent };
    });
    out.buttons = [...document.querySelectorAll('button,[role="button"]')].map((b: any) => {
      const r = b.getBoundingClientRect();
      const t = (b.textContent||'').replace(/\s+/g,' ').trim();
      const aria = b.getAttribute('aria-label')||'';
      if (!b.offsetParent) return null;
      if (r.width<8 || r.height<8) return null;
      return { t: t.slice(0,40), aria: aria.slice(0,40), x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
    }).filter(Boolean).slice(0, 80);
    // pill-like elements possibly showing model name
    out.pills = [...document.querySelectorAll('button,[role="button"],div')].map((b:any)=>{
      const t=(b.textContent||'').replace(/\s+/g,' ').trim();
      if (/nano banana|veo|imagen|image|video|frames|ingredients|1:1|16:9|9:16/i.test(t) && t.length<=30 && b.offsetParent) {
        const r=b.getBoundingClientRect();
        return { t, x:Math.round(r.x), y:Math.round(r.y), w:Math.round(r.width), h:Math.round(r.height) };
      }
      return null;
    }).filter(Boolean).slice(0,40);
    return out;
  });
  console.log(JSON.stringify(info, null, 1));
  await page.screenshot({ path: '/root/.openclaw/workspace/AUTOMATION-LABGOOGLE/out/dtq-live.png', fullPage: false });
  console.log('SHOT_SAVED');
  await browser.close();
})().catch(e => { console.error('PROBE_ERR', e?.message || e); process.exit(1); });
