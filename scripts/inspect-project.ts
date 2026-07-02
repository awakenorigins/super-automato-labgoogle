import { chromium } from 'playwright';
const OUT = '/root/.openclaw/workspace/AUTOMATION-LABGOOGLE/out';
(async () => {
  const ctx = await chromium.launchPersistentContext('/root/.openclaw/workspace/google-flow-vps-profile', {
    headless: true, args: ['--no-sandbox'], viewport: { width: 1366, height: 900 },
    locale: 'en-US', timezoneId: 'America/Los_Angeles',
  });
  const p = ctx.pages()[0] || await ctx.newPage();
  // Open Flow, create new project, inspect the composer/agent UI
  await p.goto('https://labs.google/fx/tools/flow', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(7000);
  // Click New project
  const newBtn = p.locator('button:has-text("New project"), [role="button"]:has-text("New project")').first();
  if (await newBtn.count().catch(()=>0)) await newBtn.click({ timeout: 8000 }).catch(()=>{});
  await p.waitForTimeout(8000);
  // Dump: all textareas, contenteditable, inputs, buttons near prompt area
  const info = await p.evaluate(() => {
    const url = location.href;
    // Find visible textareas
    const tas = [...document.querySelectorAll('textarea')].filter((t:any)=>t.offsetParent!==null).map((t:any)=>({
      ph: t.placeholder, aria: t.getAttribute('aria-label'), name: t.name, rows: t.rows,
      parentClass: (t.parentElement?.className||'').slice(0,60)
    }));
    // Find visible contenteditable
    const ces = [...document.querySelectorAll('[contenteditable="true"]')].filter((e:any)=>e.offsetParent!==null).map((e:any)=>({
      tag: e.tagName, aria: e.getAttribute('aria-label'),
      ph: e.getAttribute('data-placeholder')||e.getAttribute('placeholder')||'',
      txt: (e.textContent||'').slice(0,40),
      parentClass: (e.parentElement?.className||'').slice(0,60)
    }));
    // Find visible inputs
    const inputs = [...document.querySelectorAll('input')].filter((i:any)=>i.offsetParent!==null).map((i:any)=>({
      type:i.type, ph:i.placeholder, aria:i.getAttribute('aria-label')
    }));
    // Find buttons with send/generate/arrow
    const btns = [...document.querySelectorAll('button,[role="button"]')].filter((b:any)=>b.offsetParent!==null)
      .map((b:any)=>({txt:(b.textContent||'').trim().slice(0,50), aria:b.getAttribute('aria-label')||'', disabled:b.disabled}))
      .filter((b:any)=> /send|generate|create|submit|arrow/i.test(b.txt+b.aria) || b.aria.includes('Send'));
    // Quick look for agent panel
    const panelTexts = [...document.querySelectorAll('*')].filter((e:any)=>e.children.length===0 && e.offsetParent!==null && /what do you want|concept art|start creating/i.test(e.textContent||'')).map((e:any)=>(e.textContent||'').trim().slice(0,80)).slice(0,4);
    return { url, textareas: tas, editables: ces, inputs, sendBtns: btns, panelTexts };
  });
  console.log(JSON.stringify(info, null, 1));
  await ctx.close();
})();
