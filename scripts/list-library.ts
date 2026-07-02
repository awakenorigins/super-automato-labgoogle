import { chromium } from 'playwright';
(async () => {
  const ctx = await chromium.launchPersistentContext('/root/.openclaw/workspace/google-flow-vps-profile', {
    headless: true, args: ['--no-sandbox'], viewport: { width: 1366, height: 900 },
    locale: 'en-US', timezoneId: 'America/Los_Angeles',
  });
  const p = ctx.pages()[0] || await ctx.newPage();
  // Go straight to Flow project list, open most recent project, look for videos.
  await p.goto('https://labs.google/fx/tools/flow', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(7000);
  // Click the first existing project tile (most recent)
  const proj = p.locator('[role="button"]:has-text("Edit project")').first();
  let entered = false;
  // The project card itself is clickable; try the card container near edit button
  const cards = p.locator('a[href*="/project/"], div[class*="project" i]');
  try {
    const firstCard = p.locator('a[href*="/project/"]').first();
    if (await firstCard.count().catch(()=>0)) { await firstCard.click({timeout:6000}); entered=true; }
  } catch {}
  await p.waitForTimeout(9000);
  const info = await p.evaluate(() => {
    const vids = [...document.querySelectorAll('video')].map((v: any) => ({ src: (v.src||v.currentSrc||'').slice(0,90), ready: v.readyState }));
    const imgs = [...document.querySelectorAll('img[src*="googleusercontent"], img[src*="video"]')].map((i:any)=> (i.src||'').slice(0,90)).slice(0,6);
    const txt = document.body.innerText;
    const creating = /Creating|Generating|in progress/i.test(txt);
    const failed = /failed|error|policy|violate/i.test(txt);
    const dlBtns = [...document.querySelectorAll('button,[role="menuitem"]')].map((b:any)=>(b.textContent||'').trim()).filter((t:string)=>/download/i.test(t)).slice(0,3);
    return { url: location.href, entered: location.href.includes('/project/'), vidCount: vids.length, vids, imgs, creating, failed, dlBtns };
  });
  console.log(JSON.stringify(info));
  await ctx.close();
})();
