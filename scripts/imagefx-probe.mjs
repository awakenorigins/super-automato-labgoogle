import { chromium } from 'playwright';

const CDP = process.env.LABGOOGLE_CDP || 'http://127.0.0.1:18899';
const URLS = [
  'https://labs.google/fx/tools/image-fx',
  'https://aitestkitchen.withgoogle.com/tools/image-fx',
];

const browser = await chromium.connectOverCDP(CDP, { timeout: 30000 });
const ctx = browser.contexts()[0];
const page = ctx.pages().find(p => !/^chrome:|^devtools:/.test(p.url())) || ctx.pages()[0] || await ctx.newPage();

for (const u of URLS) {
  try {
    await page.goto(u, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(7000);
    await page.keyboard.press('Escape').catch(()=>{});
    await page.waitForTimeout(500);
    const info = await page.evaluate(() => {
      const bt = (document.body.innerText||'').replace(/\s+/g,' ');
      return {
        url: location.href,
        title: document.title,
        signedInHint: /sign in|log in/i.test(bt) ? 'MAYBE_SIGNED_OUT' : 'ok',
        hasPromptBox: [...document.querySelectorAll('textarea,[contenteditable="true"]')].filter(e=>e.offsetParent).length,
        creditsMention: /credit/i.test(bt),
        snippet: bt.slice(0, 500),
      };
    });
    console.log('=== ' + u + ' ===');
    console.log(JSON.stringify(info, null, 1));
    const safe = u.replace(/[^a-z0-9]+/gi,'_').slice(0,40);
    await page.screenshot({ path: `/root/.openclaw/workspace/AUTOMATION-LABGOOGLE/out/imagefx-${safe}.png` });
  } catch (e) {
    console.log('=== ' + u + ' ERR: ' + (e?.message||e));
  }
}
await browser.close();
