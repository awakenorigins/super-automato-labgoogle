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
    const out: any = { url: location.href, title: document.title };
    out.textareas = [...document.querySelectorAll('textarea')].map((t: any) => ({ ph: t.placeholder, aria: t.getAttribute('aria-label'), name: t.name, visible: !!(t.offsetWidth||t.offsetHeight) }));
    out.editables = [...document.querySelectorAll('[contenteditable="true"]')].map((e: any) => ({ aria: e.getAttribute('aria-label'), ph: e.getAttribute('data-placeholder')||e.getAttribute('placeholder'), txt: (e.textContent||'').slice(0,40) }));
    out.buttons = [...document.querySelectorAll('button, [role="button"]')].map((b: any) => (b.textContent||'').trim()).filter((x:string)=>x).slice(0, 40);
    out.inputs = [...document.querySelectorAll('input')].map((i:any)=>({type:i.type, ph:i.placeholder, aria:i.getAttribute('aria-label')})).slice(0,20);
    return out;
  });
  console.log(JSON.stringify(info, null, 1));
  await ctx.close();
})();
