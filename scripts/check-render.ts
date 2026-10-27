import { chromium } from 'playwright';
(async () => {
  const ctx = await chromium.launchPersistentContext('/root/.openclaw/workspace/google-flow-vps-profile', {
    headless: true, args: ['--no-sandbox'], viewport: { width: 1366, height: 900 },
    locale: 'en-US', timezoneId: 'America/Los_Angeles',
  });
  const p = ctx.pages()[0] || await ctx.newPage();
  await p.goto('https://labs.google/fx/tools/flow', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(8000);
  const info = await p.evaluate(() => {
    const out: any = {};
    out.videos = [...document.querySelectorAll('video')].map((v: any) => ({ src: (v.src||v.currentSrc||'').slice(0,60), poster: !!v.poster }));
    out.progress = [...document.querySelectorAll('[role="progressbar"], progress')].length;
    out.loadingText = [...document.querySelectorAll('*')].map((e:any)=> (e.childElementCount===0 ? (e.textContent||'').trim() : '')).filter((t:string)=> /generating|render|loading|processing|creating|%/i.test(t)).slice(0,8);
    out.projectCount = [...document.querySelectorAll('[role="button"]')].filter((b:any)=>/edit project/i.test(b.textContent||'')).length;
    return out;
  });
  console.log(JSON.stringify(info));
  await ctx.close();
})();
