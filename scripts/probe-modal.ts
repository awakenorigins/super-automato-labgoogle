import { chromium } from 'playwright';
const PROFILE = process.env.LABGOOGLE_PROFILE || '/root/.openclaw/workspace/google-flow-vps-profile-v2';
(async () => {
  const ctx = await chromium.launchPersistentContext(PROFILE, {
    headless: true, args: ['--no-sandbox','--disable-dev-shm-usage','--disable-blink-features=AutomationControlled'],
    viewport: { width: 1366, height: 900 }, locale: 'en-US', timezoneId: 'America/Los_Angeles',
  });
  try {
    const page = ctx.pages()[0] || (await ctx.newPage());
    await page.goto('https://labs.google/fx/tools/flow', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const nb = page.locator('button:has-text("New project"), [role="button"]:has-text("New project")').first();
    if (await nb.count().catch(()=>0)) { await nb.click({timeout:8000}).catch(()=>{}); }
    await page.waitForTimeout(8000);
    const info = await page.evaluate(() => {
      const dlg = document.querySelector('[role="dialog"], dialog, [aria-modal="true"], [class*="modal" i]');
      const btns = [...document.querySelectorAll('button')].map(b => ({
        text: (b.textContent||'').trim().slice(0,50),
        aria: b.getAttribute('aria-label'),
        cls: (b.className||'').toString().slice(0,80),
        visible: !!(b.offsetParent),
      })).filter(b => b.visible);
      const tas = [...document.querySelectorAll('textarea, [contenteditable="true"], input[type="text"]')].map(t => ({
        tag: t.tagName, ph: t.getAttribute('placeholder'), aria: t.getAttribute('aria-label'), visible: !!((t as HTMLElement).offsetParent),
      }));
      return { url: location.href, hasDialog: !!dlg, dialogTag: dlg?.tagName, dialogRole: dlg?.getAttribute('role'), dialogClass: (dlg?.className||'').toString().slice(0,120), buttons: btns.slice(0,30), textInputs: tas };
    });
    console.log(JSON.stringify(info, null, 1));
    await page.screenshot({ path: '/root/.openclaw/workspace/AUTOMATION-LABGOOGLE/out/probe-modal.png', fullPage: false });
  } finally { await ctx.close(); }
})();
