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
    await page.waitForTimeout(9000);

    // kill overlays: role=dialog announcement + fixed full-screen backdrops
    const removed = await page.evaluate(() => {
      let n = 0;
      for (const d of [...document.querySelectorAll('[role="dialog"]')]) {
        const t = (d as HTMLElement).innerText || '';
        if (/Apply to be Featured|Community Gallery|What's new|Introducing/i.test(t)) { d.remove(); n++; }
      }
      for (const el of [...document.querySelectorAll('body > div')] as HTMLElement[]) {
        const cs = getComputedStyle(el);
        if (cs.position === 'fixed' && el.offsetWidth >= innerWidth * 0.9 && el.offsetHeight >= innerHeight * 0.9 && parseInt(cs.zIndex || '0') > 10 && /Apply to be Featured|Community Gallery/i.test(el.innerText || '')) { el.remove(); n++; }
      }
      return n;
    });
    await page.keyboard.press('Escape').catch(()=>{});
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${OUT}/probe-compose-1.png` });

    // type into composer
    const field = page.locator('div[contenteditable="true"]:visible, textarea:visible, input[aria-label="Editable text"]').first();
    const fieldCount = await field.count().catch(()=>0);
    let typed = false;
    if (fieldCount) {
      try { await field.click({ timeout: 6000 }); await page.keyboard.type('A tiny robot waves hello in a sunny lab, 4 seconds, cute'); typed = true; } catch (e) { console.log('type-err', String(e).slice(0,150)); }
    }
    await page.screenshot({ path: `${OUT}/probe-compose-2.png` });

    let submitted = false;
    if (typed) {
      const create = page.locator('button:has-text("Create")').last();
      if (await create.count().catch(()=>0)) { try { await create.click({ timeout: 6000 }); submitted = true; } catch {} }
      if (!submitted) { await page.keyboard.press('Enter').catch(()=>{}); submitted = true; }
    }
    await page.waitForTimeout(15000);
    await page.screenshot({ path: `${OUT}/probe-compose-3.png` });
    const state = await page.evaluate(() => ({
      url: location.href,
      vids: document.querySelectorAll('video').length,
      bodySnippet: (document.body.innerText || '').replace(/\s+/g,' ').slice(0, 600),
    }));
    console.log(JSON.stringify({ removed, fieldCount, typed, submitted, state }, null, 1));
  } finally { await ctx.close(); }
})();
