import { chromium } from 'playwright';
(async () => {
  const ctx = await chromium.launchPersistentContext('/root/.openclaw/workspace/youtube-cli/yt-forever-profile', {
    headless: true,
    args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
    viewport: { width: 1366, height: 900 },
    locale: 'en-US',
    timezoneId: 'America/Los_Angeles',
  });
  try {
    const page = ctx.pages()[0] || (await ctx.newPage());
    await page.goto('https://labs.google/fx/tools/flow', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const url1 = page.url();
    await page.screenshot({ path: '/root/.openclaw/workspace/AUTOMATION-LABGOOGLE/out/ytprofile-flow.png' });
    let sess = '';
    try { const r = await ctx.request.get('https://labs.google/fx/api/auth/session'); sess = (await r.text()).slice(0, 200); } catch {}
    const signedIn = /"email"/.test(sess);
    // NotebookLM check
    await page.goto('https://notebooklm.google.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const url2 = page.url();
    await page.screenshot({ path: '/root/.openclaw/workspace/AUTOMATION-LABGOOGLE/out/ytprofile-nlm.png' });
    const nlmOk = url2.startsWith('https://notebooklm.google.com') && !url2.includes('accounts.google');
    console.log(JSON.stringify({ flowUrl: url1.slice(0,100), labsSignedIn: signedIn, nlmUrl: url2.slice(0,100), nlmOk }));
  } finally { await ctx.close(); }
})();
