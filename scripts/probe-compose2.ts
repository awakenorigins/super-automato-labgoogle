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

    const fields = await page.evaluate(() => {
      const out: any[] = [];
      for (const el of [...document.querySelectorAll('textarea, [contenteditable="true"], input')] as HTMLElement[]) {
        const r = el.getBoundingClientRect();
        out.push({ tag: el.tagName, type: el.getAttribute('type'), aria: el.getAttribute('aria-label'), ph: el.getAttribute('placeholder'), ce: el.getAttribute('contenteditable'), x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), display: getComputedStyle(el).display, vis: getComputedStyle(el).visibility, parentCls: (el.parentElement?.className||'').toString().slice(0,60) });
      }
      return out;
    });
    console.log(JSON.stringify(fields, null, 1));

    // Try: click composer area text "What do you want to create?" region then type
    const composer = await page.evaluate(() => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
      let target: HTMLElement | null = null;
      while (walker.nextNode()) {
        const el = walker.currentNode as HTMLElement;
        if (el.childElementCount === 0 && /What do you want to create/i.test(el.textContent || '')) { target = el; break; }
      }
      if (!target) return null;
      const r = target.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2, text: target.textContent };
    });
    console.log('composer hint:', JSON.stringify(composer));
    if (composer) {
      await page.mouse.click(composer.x, composer.y);
      await page.waitForTimeout(1500);
      await page.keyboard.type('A tiny robot waves hello in a sunny lab, 4 seconds, cute', { delay: 20 });
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `${OUT}/probe2-typed.png` });
      const after = await page.evaluate(() => (document.activeElement ? { tag: document.activeElement.tagName, aria: document.activeElement.getAttribute('aria-label'), value: (document.activeElement as HTMLInputElement).value?.slice(0,80) || (document.activeElement as HTMLElement).innerText?.slice(0,80) } : null));
      console.log('activeAfterType:', JSON.stringify(after));
      // click arrow_forward Create
      const create = page.locator('button:has-text("arrow_forwardCreate"), button:has-text("Create")').last();
      await create.click({ timeout: 8000 }).catch(e => console.log('create-click-err', String(e).slice(0,120)));
      await page.waitForTimeout(12000);
      await page.screenshot({ path: `${OUT}/probe2-submitted.png` });
      const st = await page.evaluate(() => ({ url: location.href, vids: document.querySelectorAll('video').length, body: (document.body.innerText||'').replace(/\s+/g,' ').slice(0,500) }));
      console.log('after-submit:', JSON.stringify(st));
    }
  } finally { await ctx.close(); }
})();
