import { chromium } from 'playwright';
const PROFILE = process.env.LABGOOGLE_PROFILE || '/root/.openclaw/workspace/google-flow-vps-profile-v2';
const OUT = '/root/.openclaw/workspace/AUTOMATION-LABGOOGLE/out';
const HINT = process.env.LABGOOGLE_ACCOUNT || '';
function mask(s: string) { return s.replace(/([a-zA-Z0-9._%+-])[a-zA-Z0-9._%+-]*@([a-zA-Z0-9.-]+)/g, '$1***@$2'); }
(async () => {
  const ctx = await chromium.launchPersistentContext(PROFILE, {
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-blink-features=AutomationControlled'],
    viewport: { width: 1366, height: 900 }, locale: 'en-US', timezoneId: 'America/Los_Angeles',
  });
  const steps: any[] = [];
  try {
    const page = ctx.pages()[0] || (await ctx.newPage());
    const shot = async (tag: string) => { const p = `${OUT}/restore-${tag}-${Date.now()}.png`; await page.screenshot({ path: p, fullPage: false }).catch(()=>{}); return p; };
    const session = async () => { try { const r = await ctx.request.get('https://labs.google/fx/api/auth/session'); const t = await r.text(); return { status: r.status(), signedIn: /"email"/.test(t), len: t.length }; } catch (e:any) { return { status: 0, signedIn: false, len: 0 }; } };

    await page.goto('https://labs.google/fx/tools/flow', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    steps.push({ step: 'open-flow', url: mask(page.url()), shot: await shot('flow-open'), session: await session() });
    let s = steps[steps.length-1].session;

    if (!s.signedIn) {
      // find a Sign in control
      const signin = page.locator('a:has-text("Sign in"), button:has-text("Sign in"), a[href*="ServiceLogin"], a[href*="accounts.google.com"]').first();
      if (await signin.count().catch(()=>0)) {
        await signin.click({ timeout: 10000 }).catch(()=>{});
        await page.waitForTimeout(9000);
      } else {
        // direct nav to labs login route
        await page.goto('https://labs.google/fx/api/auth/signin?callbackUrl=/fx/tools/flow', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(()=>{});
        await page.waitForTimeout(8000);
      }
      steps.push({ step: 'after-signin-click', url: mask(page.url()), shot: await shot('signin-1') });

      // if landed on nextauth provider page, click Google provider button
      if (/labs\.google\/fx\/api\/auth\/signin/.test(page.url())) {
        const g = page.locator('button:has-text("Google"), form button').first();
        if (await g.count().catch(()=>0)) { await g.click({ timeout: 10000 }).catch(()=>{}); await page.waitForTimeout(9000); }
        steps.push({ step: 'provider-click', url: mask(page.url()), shot: await shot('signin-2') });
      }

      // account chooser
      for (let i = 0; i < 3 && /accounts\.google\.com/.test(page.url()); i++) {
        const acct = page.locator(`[data-identifier*="${HINT}" i], div[role="link"]:has-text("${HINT}"), li:has-text("${HINT}")`).first();
        if (await acct.count().catch(()=>0)) { await acct.click({ timeout: 10000 }).catch(()=>{}); }
        else {
          const cont = page.locator('button:has-text("Continue"), #submit_approve_access, button:has-text("Next")').first();
          if (await cont.count().catch(()=>0)) await cont.click({ timeout: 10000 }).catch(()=>{});
          else break;
        }
        await page.waitForTimeout(9000);
        steps.push({ step: `chooser-${i}`, url: mask(page.url()), shot: await shot(`chooser-${i}`) });
      }
      await page.waitForTimeout(5000);
      s = await session();
      steps.push({ step: 'final', url: mask(page.url()), shot: await shot('final'), session: s });
    }
    console.log(JSON.stringify({ ok: s.signedIn, signedIn: s.signedIn, steps }, null, 2));
  } finally { await ctx.close(); }
})();
