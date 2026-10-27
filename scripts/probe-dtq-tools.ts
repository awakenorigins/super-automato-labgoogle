import { chromium } from 'playwright';
const CDP = process.env.LABGOOGLE_CDP || 'http://127.0.0.1:18899';
const OUT = '/root/.openclaw/workspace/AUTOMATION-LABGOOGLE/out';

(async () => {
  const browser = await chromium.connectOverCDP(CDP, { timeout: 30000 });
  const ctx = browser.contexts()[0];
  const page = ctx.pages().find(p => /flow\/project/.test(p.url())) || ctx.pages()[0];
  console.log('URL', page.url());

  // Click "Tools" in left sidebar
  const clicked = await page.evaluate(() => {
    const els = [...document.querySelectorAll('button,[role="button"],a,div,span')] as HTMLElement[];
    const b = els.find(e => (e.textContent||'').replace(/\s+/g,' ').trim() === 'Tools' && e.offsetParent);
    if (b) { (b as HTMLElement).click(); return true; }
    return false;
  });
  console.log('tools_clicked', clicked);
  await page.waitForTimeout(3500);
  await page.screenshot({ path: `${OUT}/dtq-tools.png`, fullPage: false });

  const menu = await page.evaluate(() => {
    return [...document.querySelectorAll('button,[role="button"],a,[role="menuitem"],li')].map((e:any)=>{
      const t=(e.textContent||'').replace(/\s+/g,' ').trim();
      if (!e.offsetParent || !t || t.length>50) return null;
      const r=e.getBoundingClientRect();
      return { t, x:Math.round(r.x), y:Math.round(r.y) };
    }).filter(Boolean).slice(0,60);
  });
  console.log(JSON.stringify(menu));
  console.log('DONE');
  await browser.close();
})().catch(e=>{ console.error('ERR', e?.message||e); process.exit(1); });
