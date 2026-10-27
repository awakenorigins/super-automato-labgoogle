import { chromium } from 'playwright';
const PROJECT = 'https://labs.google/fx/tools/flow/project/8df52104-3632-4522-a75d-1ce23d82e8bc';
const OUT = '/root/.openclaw/workspace/AUTOMATION-LABGOOGLE/out';
(async () => {
  const ctx = await chromium.launchPersistentContext('/root/.openclaw/workspace/google-flow-vps-profile', {
    headless: true, args: ['--no-sandbox'], viewport: { width: 1366, height: 900 },
    locale: 'en-US', timezoneId: 'America/Los_Angeles',
  });
  const p = ctx.pages()[0] || await ctx.newPage();
  await p.goto(PROJECT, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(9000);
  const shot = `${OUT}/probe-card-${Date.now()}.png`;
  await p.screenshot({ path: shot, fullPage: true });
  const info = await p.evaluate(() => {
    // Look only at visible media area, not the i18n bundle.
    const spinners = [...document.querySelectorAll('[role="progressbar"], [class*="spinner" i], [class*="loading" i]')].filter((e:any)=> e.offsetParent !== null).length;
    const visibleCreating = [...document.querySelectorAll('*')].filter((e:any)=> e.children.length===0 && e.offsetParent!==null && /^(Creating|Generating)/i.test((e.textContent||'').trim())).map((e:any)=>(e.textContent||'').trim()).slice(0,4);
    const errorTexts = [...document.querySelectorAll('*')].filter((e:any)=> e.children.length===0 && e.offsetParent!==null && /(failed|error|policy|violate|couldn't|try again|safety)/i.test(e.textContent||'')).map((e:any)=>(e.textContent||'').trim()).slice(0,4);
    const videos = [...document.querySelectorAll('video')].map((v:any)=>({src:(v.src||v.currentSrc||'').slice(0,80)}));
    const credits = (document.body.innerText.match(/[\d,]+\s*(credits?|monthly credits)/i)||[])[0]||'';
    return { spinners, visibleCreating, errorTexts, videos, credits };
  });
  console.log(JSON.stringify({ shot, ...info }));
  await ctx.close();
})();
