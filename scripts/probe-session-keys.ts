#!/usr/bin/env tsx
// Inspect labs session JSON *structure* for a profile. Prints KEYS + booleans only, never values.
import { chromium } from 'playwright';
const PROFILE = process.env.P || '/root/.openclaw/workspace/google-flow-vps-profile-v2';
(async () => {
  const ctx = await chromium.launchPersistentContext(PROFILE, {
    headless: true, args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
    viewport: { width: 1366, height: 900 }, locale: 'en-US', timezoneId: 'America/Los_Angeles',
  });
  try {
    const r = await ctx.request.get('https://labs.google/fx/api/auth/session');
    const t = await r.text();
    let j: any = null; try { j = JSON.parse(t); } catch {}
    const walk = (o: any, p = ''): string[] => o && typeof o === 'object' ? Object.entries(o).flatMap(([k, v]) => { const kp = p ? `${p}.${k}` : k; return typeof v === 'object' && v ? walk(v, kp) : [`${kp}=<${typeof v}:${String(v).length}ch>`]; }) : [];
    console.log(JSON.stringify({
      status: r.status(), keys: j ? walk(j) : null,
      hasEmail: /"email"/.test(t), hasAccessToken: !!(j && j.access_token),
      error: j?.error || null, expires: j?.expires || null,
      rawLen: t.length,
    }, null, 1));
  } finally { await ctx.close(); }
})();
