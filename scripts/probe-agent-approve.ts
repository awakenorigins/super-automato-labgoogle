#!/usr/bin/env tsx
/**
 * probe-agent-approve.ts — Inspect Flow Agent-mode "Credit Spend Approval" DOM
 * to find the REAL affordance that kicks off a render (vs. the checkbox-style labels).
 *
 *   LABGOOGLE_PROFILE=... xvfb-run -a npx tsx scripts/probe-agent-approve.ts
 */
import { chromium, Page } from 'playwright';
import * as fs from 'fs';

const PROFILE = process.env.LABGOOGLE_PROFILE || '/root/.openclaw/workspace/google-flow-vps-profile-v2';
const OUT = '/root/.openclaw/workspace/AUTOMATION-LABGOOGLE/out/agent-probe';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36';
const PROJECT_ID = '11868fdd-f96a-4163-b1cf-37301d44c4bd'; // automato-film-tro
const PROMPT = 'A single ripe red apple on a plain wooden table, soft daylight, macro, photorealistic.';
fs.mkdirSync(OUT, { recursive: true });

async function dumpButtons(page: Page, tag: string) {
  const data = await page.evaluate(() => {
    const vis = (e: Element) => { const r = (e as HTMLElement).getBoundingClientRect(); return r.width > 4 && r.height > 4 && (e as HTMLElement).offsetParent !== null; };
    const els = [...document.querySelectorAll('button,[role="button"],[role="menuitem"],[role="menuitemcheckbox"],a')] as HTMLElement[];
    return els.filter(vis).map(e => {
      const r = e.getBoundingClientRect();
      return {
        tag: e.tagName.toLowerCase(),
        role: e.getAttribute('role') || '',
        text: (e.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40),
        aria: e.getAttribute('aria-label') || '',
        disabled: (e as HTMLButtonElement).disabled || e.getAttribute('aria-disabled') === 'true',
        x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2),
      };
    }).filter(b => b.text || b.aria);
  }).catch(() => []);
  fs.writeFileSync(`${OUT}/buttons-${tag}.json`, JSON.stringify(data, null, 2));
  return data;
}

(async () => {
  const ctx = await chromium.launchPersistentContext(PROFILE, {
    headless: false, userAgent: UA, viewport: { width: 1366, height: 900 },
    locale: 'en-US', timezoneId: 'America/Los_Angeles',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-blink-features=AutomationControlled', '--window-size=1366,900'],
  });
  const page: Page = ctx.pages()[0] || await ctx.newPage();
  const shot = async (t: string) => { const p = `${OUT}/p-${t}.png`; await page.screenshot({ path: p, fullPage: false }).catch(() => {}); };
  try {
    await page.goto(`https://labs.google/fx/tools/flow/project/${PROJECT_ID}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(9000); await shot('01-open');

    // type prompt into composer
    const ceRect = await page.evaluate(() => { const ce = [...document.querySelectorAll('[contenteditable="true"]')].find(e => (e as HTMLElement).offsetParent) as HTMLElement | undefined; if (!ce) return null; ce.focus(); const r = ce.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }).catch(() => null as any);
    if (ceRect) { await page.mouse.click(ceRect.x, ceRect.y); await page.waitForTimeout(600); await page.keyboard.insertText(PROMPT); }
    await page.waitForTimeout(1500); await shot('02-typed');
    await dumpButtons(page, '02-typed');

    // submit (Enter or arrow_forward Create)
    const btnRect = await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /arrow_forward/.test(x.textContent || '') && (x as HTMLElement).offsetParent) as HTMLElement | undefined; if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }).catch(() => null as any);
    if (btnRect) await page.mouse.click(btnRect.x, btnRect.y); else await page.keyboard.press('Enter');
    await page.waitForTimeout(6000); await shot('03-after-submit');
    const btns = await dumpButtons(page, '03-after-submit');

    // Try the standalone "Approve" button (last one), record what changes
    const approveBtns = btns.filter((b: any) => /^(check\s*)?Approve$/i.test(b.text));
    fs.writeFileSync(`${OUT}/approve-candidates.json`, JSON.stringify(approveBtns, null, 2));
    if (approveBtns.length) {
      // click the last Approve (usually the actionable button on the right)
      const t = approveBtns[approveBtns.length - 1];
      await page.mouse.click(t.x, t.y);
      await page.waitForTimeout(8000); await shot('04-after-approve');
      await dumpButtons(page, '04-after-approve');
      // dump whether a "Creating/Generating" state or progress appeared
      const state = await page.evaluate(() => {
        const t = document.body.innerText || '';
        return {
          creating: /Creating|Generating|Rendering|in progress|processing|Starting/i.test(t),
          stillAsking: /kick off this|costing \d+ credits|Credit Spend Approval/i.test(t),
          videoCount: document.querySelectorAll('video').length,
          bodySnippet: t.replace(/\s+/g, ' ').slice(0, 400),
        };
      });
      fs.writeFileSync(`${OUT}/after-approve-state.json`, JSON.stringify(state, null, 2));
      console.log(JSON.stringify(state, null, 1));
    }
  } catch (e: any) { console.log('ERR', String(e?.message || e)); }
  await ctx.close();
})();
