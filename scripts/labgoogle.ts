#!/usr/bin/env tsx
/**
 * labgoogle — agent-native CLI for Google Labs FX (Flow / MusicFX / NotebookLM)
 * Uses the persistent VPS Playwright profile authed as Google Ultra.
 *
 * Commands:
 *   labgoogle whoami                         -> { signedIn, account(masked), plan? }
 *   labgoogle flow gen --prompt "..." [--image PATH] [--out DIR] [--ratio 16:9] [--json]
 *   labgoogle music gen --prompt "..." [--out DIR] [--json]
 *
 * Security: NEVER prints cookies/tokens. Account is masked. Boolean/status only.
 */
import { chromium, BrowserContext, Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { execFileSync } from 'child_process';

const PROFILE = process.env.LABGOOGLE_PROFILE || '/root/.openclaw/workspace/google-flow-vps-profile-v2';
const STORAGE = process.env.LABGOOGLE_STORAGE || '/root/.openclaw/workspace/google-flow-vps-storage-state-v2.json';
const FLOW_URL = 'https://labs.google/fx/tools/flow';
const MUSIC_URL = 'https://labs.google/fx/tools/music-fx';
const SESSION_API = 'https://labs.google/fx/api/auth/session';
const NLM_URL = 'https://notebooklm.google.com/';
const ACCOUNT_HINT = process.env.LABGOOGLE_ACCOUNT || '';
const PRESET_DIR = '/root/.openclaw/workspace/AUTOMATION-LABGOOGLE/presets';

type Args = Record<string, string | boolean>;

function parseArgs(argv: string[]): { cmd: string; sub: string; args: Args } {
  const cmd = argv[0] || '';
  const sub = argv[1] && !argv[1].startsWith('--') ? argv[1] : '';
  const rest = argv.slice(sub ? 2 : 1);
  const args: Args = {};
  for (let i = 0; i < rest.length; i++) {
    const t = rest[i];
    if (t.startsWith('--')) {
      const key = t.slice(2);
      const next = rest[i + 1];
      if (next === undefined || next.startsWith('--')) { args[key] = true; }
      else { args[key] = next; i++; }
    }
  }
  return { cmd, sub, args };
}

function maskEmail(s: string): string {
  const m = s.match(/([a-zA-Z0-9._%+-])[a-zA-Z0-9._%+-]*@([a-zA-Z0-9.-]+)/);
  if (!m) return '(unknown)';
  return `${m[1]}***@${m[2]}`;
}

async function withContext<T>(fn: (ctx: BrowserContext, page: Page) => Promise<T>): Promise<T> {
  const ctx = await chromium.launchPersistentContext(PROFILE, {
    headless: true,
    args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
    viewport: { width: 1366, height: 900 },
    locale: 'en-US',
    timezoneId: 'America/Los_Angeles',
    acceptDownloads: true,
  });
  try {
    const page = ctx.pages()[0] || (await ctx.newPage());
    const r = await fn(ctx, page);
    try { await ctx.storageState({ path: STORAGE }); } catch {}
    return r;
  } finally {
    await ctx.close();
  }
}

async function getSession(page: Page): Promise<{ signedIn: boolean; account: string; raw: string }> {
  await page.goto(FLOW_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(5000);
  if (/accounts\.google\.com/.test(page.url())) {
    const acct = ACCOUNT_HINT ? page.locator(`text=${ACCOUNT_HINT}`).first() : page.locator('[data-identifier], li[role="link"]').first();
    if (await acct.count().catch(()=>0)) { await acct.click({timeout:8000}).catch(()=>{}); await page.waitForTimeout(8000); }
  }
  let raw = '';
  try {
    const r = await page.context().request.get(SESSION_API);
    raw = await r.text();
  } catch {}
  const signedIn = /"email"\s*:/.test(raw) || (ACCOUNT_HINT ? raw.includes(ACCOUNT_HINT) : false);
  const account = signedIn ? maskEmail(raw) : '(none)';
  return { signedIn, account, raw };
}

function out(json: boolean, obj: any) {
  if (json) { console.log(JSON.stringify(obj)); }
  else {
    for (const [k, v] of Object.entries(obj)) console.log(`${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`);
  }
}

async function cmdWhoami(args: Args) {
  const res = await withContext(async (_ctx, page) => {
    const s = await getSession(page);
    let plan = 'unknown';
    if (/ultra/i.test(s.raw)) plan = 'Ultra';
    else if (/pro/i.test(s.raw)) plan = 'Pro';
    return { signedIn: s.signedIn, account: s.account, plan, ts: new Date().toISOString() };
  });
  out(!!args.json, res);
}

function tsName(prefix: string, ext: string) { return `${prefix}-${Date.now()}.${ext}`; }
function fileInfo(f: string) { try { const st=fs.statSync(f); const magic=execFileSync('file',['-b',f],{encoding:'utf8'}).trim(); return { exists:true, size:st.size, file:magic }; } catch { return { exists:false, size:0, file:'' }; } }
async function findRenderedVideo(page: Page): Promise<{src:string; count:number; creating:boolean; failed:boolean}> {
  return await page.evaluate(() => {
    const vids = [...document.querySelectorAll('video')] as HTMLVideoElement[];
    const srcs = vids.map(v => v.currentSrc || v.src || v.getAttribute('src') || '').filter(Boolean);
    const real = srcs.find(s => s.startsWith('http') || s.startsWith('blob:') || s.startsWith('data:')) || '';
    const txt = document.body.innerText || '';
    return { src: real, count: vids.length, creating: /Creating|Generating|Rendering|in progress|processing/i.test(txt), failed: /failed|error|policy|violate|couldn.t|try again|safety/i.test(txt) };
  });
}
async function fetchMediaFromPage(page: Page, src: string, outPath: string): Promise<boolean> {
  try {
    if (src.startsWith('http')) { const r=await page.context().request.get(src,{timeout:120000}); if (r.ok()) { fs.writeFileSync(outPath, Buffer.from(await r.body())); return true; } }
    if (src.startsWith('blob:') || src.startsWith('data:')) {
      const b64 = await page.evaluate(async (u) => { const r=await fetch(u); const b=await r.blob(); const ab=await b.arrayBuffer(); let bin=''; const arr=new Uint8Array(ab); for (let i=0;i<arr.length;i++) bin+=String.fromCharCode(arr[i]); return btoa(bin); }, src);
      fs.writeFileSync(outPath, Buffer.from(b64,'base64')); return true;
    }
  } catch {}
  return false;
}
async function dismissModals(page: Page): Promise<number> {
  let dismissed = 0;
  for (let i = 0; i < 6; i++) {
    const hasDialog = await page.evaluate(() => {
      const d = document.querySelector('[role="dialog"], dialog[open], [aria-modal="true"]');
      return d ? ((d as HTMLElement).innerText || '').slice(0, 120) : '';
    }).catch(() => '');
    if (!hasDialog) break;
    const closeBtn = page.locator('[role="dialog"] button[aria-label*="close" i], dialog button[aria-label*="close" i], [aria-modal="true"] button[aria-label*="close" i], [role="dialog"] button:has-text("Got it"), [role="dialog"] button:has-text("Skip"), [role="dialog"] button:has-text("Dismiss"), [role="dialog"] button:has-text("No thanks"), [role="dialog"] button:has-text("Close")').first();
    if (await closeBtn.count().catch(()=>0)) { await closeBtn.click({ timeout: 4000 }).catch(()=>{}); }
    else {
      // onboarding carousels: click the last button in dialog (often "next/arrow") a few times, else Escape
      const anyBtn = page.locator('[role="dialog"] button, dialog[open] button').last();
      if (await anyBtn.count().catch(()=>0)) await anyBtn.click({ timeout: 4000 }).catch(()=>{});
      else await page.keyboard.press('Escape').catch(()=>{});
    }
    await page.keyboard.press('Escape').catch(()=>{});
    dismissed++;
    await page.waitForTimeout(2500);
  }
  return dismissed;
}
async function clickLikelySubmit(page: Page): Promise<boolean> {
  const sels=['button[aria-label*="Generate" i]','button:has-text("Generate")','button[aria-label*="Create" i]','button:has-text("Create")','button[type="submit"]','button[aria-label*="Send" i]'];
  for (const sel of sels) { const b=page.locator(sel).last(); if (await b.count().catch(()=>0)) { try { await b.click({timeout:6000}); return true; } catch {} } }
  try { await page.keyboard.press('Control+Enter'); return true; } catch {}
  try { await page.keyboard.press('Enter'); return true; } catch {}
  return false;
}
async function cmdFlowGen(args: Args) {
  const prompt = String(args.prompt || '');
  if (!prompt) { out(!!args.json, { ok: false, error: 'missing --prompt' }); process.exit(2); }
  const outDir = String(args.out || '/root/.openclaw/workspace/AUTOMATION-LABGOOGLE/out'); fs.mkdirSync(outDir,{recursive:true});
  const submit = !!args.submit; const maxWaitMs = Number(args.timeout || 600000);
  const res = await withContext(async (_ctx, page) => {
    const s = await getSession(page); if (!s.signedIn) return { ok:false, error:'not signed in — refresh cookies from PC' };
    await page.goto(FLOW_URL,{waitUntil:'domcontentloaded',timeout:60000}); await page.waitForTimeout(7000);
    await dismissModals(page);
    let opened=false; const nb=page.locator('button:has-text("New project"), [role="button"]:has-text("New project")').first(); if(await nb.count().catch(()=>0)){try{await nb.click({timeout:8000}); opened=true;}catch{}}
    await page.waitForTimeout(9000); await dismissModals(page); await page.keyboard.press('Escape').catch(()=>{}); const proofs:string[]=[]; const shot=`${outDir}/${tsName('flow-composer','png')}`; await page.screenshot({path:shot,fullPage:true}); proofs.push(shot);
    let typed=false, usedSel='';
    // New Flow agent composer: focus visible contenteditable via evaluate + insertText
    const ceRect = await page.evaluate(() => { const ce=[...document.querySelectorAll('[contenteditable="true"]')].find(e=>(e as HTMLElement).offsetParent) as HTMLElement|undefined; if(!ce) return null; ce.focus(); const r=ce.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; }).catch(()=>null as any);
    if (ceRect) { try { await page.mouse.click(ceRect.x, ceRect.y); await page.waitForTimeout(800); await page.keyboard.insertText(prompt); const check = await page.evaluate(() => { const ce=[...document.querySelectorAll('[contenteditable="true"]')].find(e=>(e as HTMLElement).offsetParent) as HTMLElement|undefined; return ce ? (ce.innerText||'') : ''; }); if (check.includes(prompt.slice(0, 20))) { typed = true; usedSel = 'contenteditable-evaluate'; } } catch {} }
    if (!typed) { for (const sel of ['textarea[placeholder*="Generate" i]','textarea[placeholder*="prompt" i]','textarea[placeholder*="describe" i]','textarea:not([name="g-recaptcha-response"])','div[contenteditable="true"]']) { const el=page.locator(sel).first(); if(await el.count().catch(()=>0) && await el.isVisible().catch(()=>false)){ try{ await el.click({timeout:4000}); await el.fill(prompt); typed=true; usedSel=sel; break;}catch{} } } }
    const shot2=`${outDir}/${tsName('flow-typed','png')}`; await page.screenshot({path:shot2,fullPage:true}); proofs.push(shot2);
    let submitted=false, rendered=false, downloadedPath='', videoUrl='', lastState:any=null; let approved=false;
    if (typed && submit) {
      // click arrow_forward Create (agent submit) by rect, fallback generic submit
      const btnRect = await page.evaluate(() => { const b=[...document.querySelectorAll('button')].find(x=>/arrow_forward/.test(x.textContent||'') && /Create/.test(x.textContent||'') && (x as HTMLElement).offsetParent) as HTMLElement|undefined; if(!b) return null; const r=b.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; }).catch(()=>null as any);
      if (btnRect) { await page.mouse.click(btnRect.x, btnRect.y); submitted = true; } else { submitted = await clickLikelySubmit(page); }
      await page.waitForTimeout(6000); const rs=`${outDir}/${tsName('flow-render','png')}`; await page.screenshot({path:rs,fullPage:true}); proofs.push(rs);
      const start=Date.now(); let nextProof=60000;
      while(Date.now()-start<maxWaitMs){
        // Flow agent may ask for credit approval — auto-approve
        if (!approved) {
          // Flow agent approval is a DIV, not <button>: match leaf-ish elements with exact 'Approve' text
          const ap = await page.evaluate(() => { const hits=[...document.querySelectorAll('*')].filter(e=>e.childElementCount<=3 && /^\s*(check\s*)?Approve\s*$/i.test((e.textContent||'').replace(/\s+/g,' ').trim())) as HTMLElement[]; const b=hits.find(x=>{const r=x.getBoundingClientRect(); return r.width>20 && r.height>10;}); if(!b) return null; const r=b.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; }).catch(()=>null as any);
          if (ap) { await page.mouse.click(ap.x, ap.y); approved = true; const aps=`${outDir}/${tsName('flow-approved','png')}`; await page.screenshot({path:aps,fullPage:true}); proofs.push(aps); }
        }
        lastState=await findRenderedVideo(page); if(lastState.src){rendered=true; videoUrl=lastState.src; break;} if(Date.now()-start>=nextProof){const ps=`${outDir}/${tsName('flow-poll','png')}`; await page.screenshot({path:ps,fullPage:true}); proofs.push(ps); nextProof+=120000;} await page.waitForTimeout(9000); }
      const ds=`${outDir}/${tsName('flow-done','png')}`; await page.screenshot({path:ds,fullPage:true}); proofs.push(ds);
      if(rendered){
        const uiPath=`${outDir}/${tsName('flow-video','mp4')}`;
        try{ await page.locator('video').first().hover({timeout:5000}).catch(()=>{}); const more=page.locator('button[aria-label*="more" i], button[aria-label*="options" i]').first(); if(await more.count().catch(()=>0)) await more.click({timeout:4000}).catch(()=>{}); const dl=page.locator('button:has-text("Download"),[role="menuitem"]:has-text("Download"),[aria-label*="Download" i]').first(); if(await dl.count().catch(()=>0)){ const [d]=await Promise.all([page.waitForEvent('download',{timeout:60000}).catch(()=>null as any), dl.click({timeout:6000}).catch(()=>{})]); if(d){await d.saveAs(uiPath); downloadedPath=uiPath;} } }catch{}
        if(!downloadedPath){ const fp=`${outDir}/${tsName('flow-video','mp4')}`; if(await fetchMediaFromPage(page, videoUrl, fp)) downloadedPath=fp; }
      }
    }
    const finfo=downloadedPath?fileInfo(downloadedPath):null;
    return { ok:true, newProjectOpened:opened, approved, stage:!typed?'composer-open-no-field':!submitted?'prompt-typed':rendered?(downloadedPath?'rendered-downloaded':'rendered-no-download'):'submitted-render-timeout', selectorUsed:usedSel||null, rendered, downloadedPath:downloadedPath||null, fileInfo:finfo, videoUrl:videoUrl?videoUrl.slice(0,120):null, lastState, note: rendered && downloadedPath?'Video rendered + downloaded.': rendered?'Video rendered; download failed.': submitted?'Submitted but render did not finish within timeout.': typed?'Prompt typed. Pass --submit to render.':'Composer opened but prompt field not found.', proofs, prompt };
  }); out(!!args.json,res);
}

async function cmdMusicGen(args: Args) {
  const prompt = String(args.prompt || '');
  if (!prompt) { out(!!args.json, { ok: false, error: 'missing --prompt' }); process.exit(2); }
  const outDir = String(args.out || '/root/.openclaw/workspace/AUTOMATION-LABGOOGLE/out'); fs.mkdirSync(outDir,{recursive:true});
  const maxWaitMs = Number(args.timeout || 600000);
  const res = await withContext(async (_ctx, page) => {
    const ses = await getSession(page); if (!ses.signedIn) return { ok:false, error:'not signed in — refresh cookies from PC' };
    const proofs:string[]=[]; let url=MUSIC_URL, fallbackTried=false;
    // Network-level audio capture: MusicFX streams generated tracks via API responses
    // (JSON with base64 audio or direct audio/* bodies). Grab them as they arrive.
    const netAudio: Buffer[] = [];
    page.on('response', async (resp) => {
      try {
        const ct = (resp.headers()['content-type'] || '').toLowerCase();
        const u = resp.url();
        if (/^audio\//.test(ct)) { const b = await resp.body(); if (b.length > 20000) netAudio.push(b); return; }
        if (/GenerateMusic|musiclm|soundDemo|aisandbox/i.test(u) && /json/.test(ct)) {
          const txt = await resp.text();
          const m = txt.match(/"(?:audioContainer|soundData|data|audio)"\s*:\s*"([A-Za-z0-9+/=_-]{40000,})"/g);
          if (m) for (const hit of m) { const b64 = hit.slice(hit.indexOf(':')+1).replace(/[":\s]/g,''); try { const buf = Buffer.from(b64.replace(/-/g,'+').replace(/_/g,'/'), 'base64'); if (buf.length > 20000) netAudio.push(buf); } catch {} }
        }
      } catch {}
    });
    await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000}); await page.waitForTimeout(8000); await dismissModals(page);
    let shot=`${outDir}/${tsName('music-open','png')}`; await page.screenshot({path:shot,fullPage:true}); proofs.push(shot);
    let typed=false, usedSel='';
    for (const sel of ['textarea[placeholder*="music" i]','textarea[placeholder*="prompt" i]','textarea','div[contenteditable="true"]']) { const el=page.locator(sel).first(); if(await el.count().catch(()=>0) && await el.isVisible().catch(()=>false)){try{await el.click({timeout:4000}); await el.fill(prompt); typed=true; usedSel=sel; break;}catch{}} }
    if(!typed){ fallbackTried=true; url='https://labs.google/fx/tools/flow'; await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000}); await page.waitForTimeout(7000); const nb=page.locator('button:has-text("New project"), [role="button"]:has-text("New project")').first(); if(await nb.count().catch(()=>0)) await nb.click({timeout:8000}).catch(()=>{}); await page.waitForTimeout(5000); await dismissModals(page); for (const sel of ['textarea','div[contenteditable="true"]']) { const el=page.locator(sel).first(); if(await el.count().catch(()=>0) && await el.isVisible().catch(()=>false)){try{await el.click({timeout:4000}); await el.fill('Create short instrumental music: '+prompt); typed=true; usedSel=sel; break;}catch{}} } }
    shot=`${outDir}/${tsName('music-typed','png')}`; await page.screenshot({path:shot,fullPage:true}); proofs.push(shot);
    let submitted=false, rendered=false, downloadedPath='', mediaUrl='', lastState:any=null; let attempts=0;
    if(typed){
      // MusicFX renders tracks WITHOUT <audio> elements (Web Audio API). Detect via
      // "TRACK n / m" carousel label / enabled Download button / captured network audio.
      // Generation is flaky (can silently return to idle) -> retry up to 3 attempts.
      const start=Date.now();
      while(!rendered && attempts<3 && Date.now()-start<maxWaitMs){
        attempts++;
        submitted=await clickLikelySubmit(page)||submitted; await page.waitForTimeout(6000);
        if(attempts===1){ shot=`${outDir}/${tsName('music-render','png')}`; await page.screenshot({path:shot,fullPage:true}); proofs.push(shot); }
        let sawCreating=false;
        while(Date.now()-start<maxWaitMs){
          lastState=await page.evaluate(()=>{ const els=[...document.querySelectorAll('audio,video')] as any[]; const src=(els.map(e=>e.currentSrc||e.src||e.getAttribute('src')||'').find(Boolean)||''); const txt=document.body.innerText||''; const trackMatch=txt.match(/TRACK\s*(\d+)\s*\/\s*(\d+)/i); const noTracks=/NO TRACKS YET/i.test(txt); const dlBtn=[...document.querySelectorAll('button')].some(b=>/download/i.test(b.textContent||'') && (b as HTMLElement).offsetParent && !(b as HTMLButtonElement).disabled && !b.hasAttribute('disabled') && b.getAttribute('aria-disabled')!=='true'); return {src, count:els.length, tracks:trackMatch?Number(trackMatch[2]):0, noTracks, hasDownload:dlBtn, creating:/Generating music|Creating|Rendering|processing|in progress/i.test(txt), blocked:/failed|error|try again|policy|not available in your country/i.test(txt)}; });
          (lastState as any).netAudioChunks = netAudio.length;
          if(lastState.creating) sawCreating=true;
          if(lastState.src || lastState.tracks>0 || netAudio.length>0 || (lastState.hasDownload && !lastState.noTracks && !lastState.creating)){ rendered=true; mediaUrl=lastState.src||''; break;}
          if(sawCreating && !lastState.creating && lastState.noTracks){ break; } // silent fail -> retry
          if(lastState.blocked && !lastState.creating) break;
          await page.waitForTimeout(8000);
        }
      }
      shot=`${outDir}/${tsName('music-done','png')}`; await page.screenshot({path:shot,fullPage:true}); proofs.push(shot);
      if(rendered){
        await page.waitForTimeout(5000); // let remaining tracks land
        try{ const dl=page.locator('button:has-text("Download"),[role="menuitem"]:has-text("Download"),[aria-label*="Download" i]').first(); if(await dl.count().catch(()=>0)){ const [d]=await Promise.all([page.waitForEvent('download',{timeout:90000}).catch(()=>null as any), dl.click({timeout:8000}).catch(()=>{})]); if(d){const sug=(d.suggestedFilename&&d.suggestedFilename())||''; const ext=sug.includes('.')?sug.slice(sug.lastIndexOf('.')+1):'mp3'; const fp2=`${outDir}/${tsName('music-audio',ext)}`; await d.saveAs(fp2); downloadedPath=fp2;} } }catch{}
        if(!downloadedPath && mediaUrl){ const fp=`${outDir}/${tsName('music-audio','mp3')}`; if(await fetchMediaFromPage(page,mediaUrl,fp)) downloadedPath=fp; }
        if(!downloadedPath && netAudio.length){ const big=netAudio.reduce((a,b)=>b.length>a.length?b:a); const fp=`${outDir}/${tsName('music-audio','audio')}`; fs.writeFileSync(fp,big); downloadedPath=fp; }
      } else if(!downloadedPath && netAudio.length){ const big=netAudio.reduce((a,b)=>b.length>a.length?b:a); const fp=`${outDir}/${tsName('music-audio','audio')}`; fs.writeFileSync(fp,big); downloadedPath=fp; rendered=true; }
    }
    return { ok:true, stage:!typed?'composer-open-no-field':!submitted?'prompt-typed':rendered?(downloadedPath?'rendered-downloaded':'rendered-no-download'):(lastState?.blocked?'blocked-or-deprecated':'submitted-render-timeout'), url, fallbackTried, attempts, selectorUsed:usedSel||null, rendered, downloadedPath:downloadedPath||null, fileInfo:downloadedPath?fileInfo(downloadedPath):null, mediaUrl:mediaUrl?mediaUrl.slice(0,120):null, lastState:lastState?{...lastState,text:undefined}:null, proofs, prompt };
  }); out(!!args.json,res);
}

type NlmState = { url: string; authWall: boolean; signedIn: boolean; shot: string };
async function nlmOpen(page: Page, outDir: string, tag: string): Promise<NlmState> {
  await page.goto(NLM_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(9000);
  let authWall = /accounts\.google\.com/.test(page.url());
  if (authWall && ACCOUNT_HINT) {
    const acct = page.locator(`text=${ACCOUNT_HINT}`).first();
    if (await acct.count().catch(()=>0)) { await acct.click({timeout:8000}).catch(()=>{}); await page.waitForTimeout(9000); authWall = /accounts\.google\.com/.test(page.url()); }
  }
  if (!authWall) await dismissModals(page);
  const shot = `${outDir}/${tsName(`nlm-${tag}`, 'png')}`;
  await page.screenshot({ path: shot, fullPage: true });
  return { url: page.url(), authWall, signedIn: !authWall, shot };
}
async function nlmListNotebooks(page: Page): Promise<Array<{title:string}>> {
  return await page.evaluate(() => {
    const cards = [...document.querySelectorAll('project-button, [class*="project-button" i], a[href*="/notebook/"], [role="listitem"]')] as HTMLElement[];
    const titles = cards.map(c => (c.textContent||'').trim().replace(/\s+/g,' ').slice(0,80)).filter(t => t && !/create new|new notebook/i.test(t));
    return [...new Set(titles)].map(title => ({ title }));
  });
}
async function nlmOpenNotebook(page: Page, ref: string): Promise<boolean> {
  const byTitle = page.locator(`text=${ref}`).first();
  if (await byTitle.count().catch(()=>0)) { try { await byTitle.click({timeout:8000}); await page.waitForTimeout(9000); return true; } catch {} }
  try { await page.goto(`https://notebooklm.google.com/notebook/${ref}`, { waitUntil:'domcontentloaded', timeout:60000 }); await page.waitForTimeout(9000); return !/accounts\.google\.com/.test(page.url()); } catch { return false; }
}
async function cmdNlmList(args: Args) {
  const outDir = String(args.out || '/root/.openclaw/workspace/AUTOMATION-LABGOOGLE/out'); fs.mkdirSync(outDir,{recursive:true});
  const res = await withContext(async (_ctx,page)=>{
    const st = await nlmOpen(page, outDir, 'list');
    if (st.authWall) return { ok:false, stage:'blocked-auth-wall', url:st.url, notebooks:[], proofs:[st.shot], note:'NotebookLM UI landed on Google account chooser (accounts signed out). Manual re-auth needed.' };
    const notebooks = await nlmListNotebooks(page);
    return { ok:true, stage:'listed', url:st.url, count:notebooks.length, notebooks, proofs:[st.shot] };
  }); out(!!args.json,res);
}
async function cmdNlmCreate(args: Args) {
  const title = String(args.title || '');
  const outDir = String(args.out || '/root/.openclaw/workspace/AUTOMATION-LABGOOGLE/out'); fs.mkdirSync(outDir,{recursive:true});
  const res = await withContext(async (_ctx,page)=>{
    const st = await nlmOpen(page, outDir, 'create');
    if (st.authWall) return { ok:false, stage:'blocked-auth-wall', url:st.url, proofs:[st.shot] };
    const proofs=[st.shot];
    const btn = page.locator('button:has-text("Create new"), button:has-text("New notebook"), button:has-text("Create"), [aria-label*="Create" i]').first();
    let created=false;
    if (await btn.count().catch(()=>0)) { try { await btn.click({timeout:8000}); created=true; } catch {} }
    await page.waitForTimeout(9000);
    if (created && title) {
      const t = page.locator('input[placeholder*="title" i], [contenteditable="true"], input[type="text"]').first();
      if (await t.count().catch(()=>0)) { try { await t.click({timeout:4000}); await t.fill(title); await page.keyboard.press('Enter'); } catch {} }
    }
    const shot=`${outDir}/${tsName('nlm-created','png')}`; await page.screenshot({path:shot,fullPage:true}); proofs.push(shot);
    return { ok:created, stage:created?'create-clicked':'create-button-not-found', url:page.url(), title:title||null, proofs };
  }); out(!!args.json,res);
}
async function cmdNlmSourceAdd(args: Args) {
  const nb=String(args.notebook||''); const url=String(args.url||''); const text=String(args.text||''); const file=String(args.file||'');
  const outDir = String(args.out || '/root/.openclaw/workspace/AUTOMATION-LABGOOGLE/out'); fs.mkdirSync(outDir,{recursive:true});
  if (!nb || (!url && !text && !file)) { out(!!args.json,{ok:false,error:'need --notebook and one of --url/--text/--file'}); process.exit(2); }
  const res = await withContext(async (_ctx,page)=>{
    const st = await nlmOpen(page, outDir, 'source');
    if (st.authWall) return { ok:false, stage:'blocked-auth-wall', url:st.url, proofs:[st.shot] };
    const proofs=[st.shot];
    if (!(await nlmOpenNotebook(page, nb))) return { ok:false, stage:'notebook-not-found', notebook:nb, proofs };
    // If the add-source modal is not already open (new notebooks auto-open it), open it.
    const modalOpen = async () => await page.locator('button:has-text("Websites"), button:has-text("Copied text")').first().isVisible().catch(()=>false);
    if (!(await modalOpen())) {
      const add = page.locator('button:has-text("Add source"), button:has-text("Add sources"), [aria-label*="Add source" i]').first();
      if (await add.count().catch(()=>0)) await add.click({timeout:8000}).catch(()=>{});
      await page.waitForTimeout(4000);
    }
    const shotM=`${outDir}/${tsName('nlm-source-modal','png')}`; await page.screenshot({path:shotM,fullPage:true}); proofs.push(shotM);
    let mode=''; let done=false;
    if (url) { mode='url';
      const tab = page.locator('button:has-text("Websites"), [role="button"]:has-text("Websites"), text=/Website|Link|YouTube/i').first();
      if (await tab.count().catch(()=>0)) await tab.click({timeout:6000}).catch(()=>{});
      await page.waitForTimeout(2500);
      const inp = page.locator('input[placeholder*="URL" i], input[type="url"], input[placeholder*="link" i], textarea[placeholder*="URL" i], [formcontrolname*="url" i]').first();
      if (await inp.count().catch(()=>0)) { try { await inp.click({timeout:4000}); await inp.fill(url); await page.waitForTimeout(1000); const ins=page.locator('button:has-text("Insert"), button:has-text("Add"), button[type="submit"]').last(); await ins.click({timeout:6000}).catch(()=>{}); done=true; } catch {} }
    } else if (text) { mode='text';
      // 'Copied text' chip opens a paste dialog; click via rect to avoid overlay issues
      const chip = await page.evaluate(() => { const b=[...document.querySelectorAll('button,[role="button"]')].find(x=>/copied text/i.test(x.textContent||'') && (x as HTMLElement).offsetParent) as HTMLElement|undefined; if(!b) return null; const r=b.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; }).catch(()=>null as any);
      if (chip) { await page.mouse.click(chip.x, chip.y); }
      await page.waitForTimeout(3500);
      const shotP=`${outDir}/${tsName('nlm-source-paste','png')}`; await page.screenshot({path:shotP,fullPage:true}); proofs.push(shotP);
      // fill the paste textarea (inside the newly opened dialog, NOT the web-search box)
      const ta = page.locator('textarea[placeholder*="paste" i], [role="dialog"] textarea, mat-dialog-container textarea').last();
      if (await ta.count().catch(()=>0)) {
        try {
          await ta.click({timeout:5000}); await ta.fill(text); await page.waitForTimeout(1000);
          const ins = page.locator('button:has-text("Insert"), button:has-text("Add")').last();
          if (await ins.count().catch(()=>0)) { await ins.click({timeout:6000}).catch(()=>{}); done=true; }
        } catch {}
      }
    } else if (file) { mode='file';
      const chooser = page.locator('input[type="file"]').first();
      if (await chooser.count().catch(()=>0)) { try { await chooser.setInputFiles(file); done=true; } catch {} }
    }
    await page.waitForTimeout(12000);
    const shot=`${outDir}/${tsName('nlm-source-done','png')}`; await page.screenshot({path:shot,fullPage:true}); proofs.push(shot);
    // verify source count in left panel
    const srcState = await page.evaluate(()=>{ const t=document.body.innerText||''; const m=t.match(/(\d+)\s+sources?/i); return { sources: m?Number(m[1]):0 }; }).catch(()=>({sources:0}));
    return { ok:done, stage:done?`source-${mode}-submitted`:'source-ui-not-found', notebook:nb, mode, sourcesSeen: (srcState as any).sources, proofs };
  }); out(!!args.json,res);
}
function loadPreset(args: Args): string {
  let pre='';
  if (args['system-file']) { try { pre = fs.readFileSync(String(args['system-file']),'utf8'); } catch {} }
  else if (args.preset) { try { pre = fs.readFileSync(path.join(PRESET_DIR, `${String(args.preset)}.txt`),'utf8'); } catch {} }
  return pre.trim();
}
async function cmdNlmChat(args: Args) {
  const nb=String(args.notebook||''); const prompt=String(args.prompt||'');
  const outDir = String(args.out || '/root/.openclaw/workspace/AUTOMATION-LABGOOGLE/out'); fs.mkdirSync(outDir,{recursive:true});
  if (!nb || !prompt) { out(!!args.json,{ok:false,error:'need --notebook and --prompt'}); process.exit(2); }
  const preset = loadPreset(args);
  const fullPrompt = preset ? `${preset}\n\n---\n${prompt}` : prompt;
  const res = await withContext(async (_ctx,page)=>{
    const st = await nlmOpen(page, outDir, 'chat');
    if (st.authWall) return { ok:false, stage:'blocked-auth-wall', url:st.url, proofs:[st.shot] };
    const proofs=[st.shot];
    if (!(await nlmOpenNotebook(page, nb))) return { ok:false, stage:'notebook-not-found', notebook:nb, proofs };
    const box = page.locator('textarea[placeholder*="Ask" i], textarea, [contenteditable="true"]').last();
    if (!(await box.count().catch(()=>0))) return { ok:false, stage:'chat-box-not-found', proofs };
    await box.click({timeout:6000}).catch(()=>{}); await box.fill(fullPrompt).catch(()=>{});
    const send = page.locator('button[aria-label*="Send" i], button[aria-label*="Submit" i], button[type="submit"]').last();
    if (await send.count().catch(()=>0)) await send.click({timeout:6000}).catch(()=>{}); else await page.keyboard.press('Enter').catch(()=>{});
    // poll answer up to 5 min: require substantive (>200 chars) AND stable across two polls
    const start=Date.now(); let answer=''; let prev=''; let stableCount=0;
    while(Date.now()-start<300000){
      await page.waitForTimeout(8000);
      answer = await page.evaluate(() => {
        const msgs=[...document.querySelectorAll('chat-message, [class*="chat-message" i], [class*="response" i], [class*="answer" i]')] as HTMLElement[];
        const last=msgs[msgs.length-1]; return last ? (last.textContent||'').trim().slice(0,6000) : '';
      });
      const busy = await page.evaluate(()=>/Drafting|generating|thinking|loading/i.test(document.body.innerText.slice(0,3000)));
      if (answer.length>200 && !busy && answer===prev) { stableCount++; if (stableCount>=1) break; } else stableCount=0;
      prev=answer;
    }
    const shot=`${outDir}/${tsName('nlm-chat-done','png')}`; await page.screenshot({path:shot,fullPage:true}); proofs.push(shot);
    return { ok:!!answer, stage:answer?'answered':'no-answer-timeout', notebook:nb, presetUsed: args.preset||args['system-file']||null, answer:answer||null, proofs };
  }); out(!!args.json,res);
}
async function cmdNlmAudio(args: Args) {
  const nb=String(args.notebook||''); const prompt=String(args.prompt||'');
  const outDir = String(args.out || '/root/.openclaw/workspace/AUTOMATION-LABGOOGLE/out'); fs.mkdirSync(outDir,{recursive:true});
  if (!nb) { out(!!args.json,{ok:false,error:'need --notebook'}); process.exit(2); }
  const maxWaitMs = Number(args.timeout || 900000);
  const res = await withContext(async (_ctx,page)=>{
    const st = await nlmOpen(page, outDir, 'audio');
    if (st.authWall) return { ok:false, stage:'blocked-auth-wall', url:st.url, proofs:[st.shot] };
    const proofs=[st.shot];
    if (!(await nlmOpenNotebook(page, nb))) return { ok:false, stage:'notebook-not-found', notebook:nb, proofs };
    // Detect an already-rendered Audio Overview artifact in the Studio panel.
    // NotebookLM mounts NO <audio> element until playback, so detect the artifact row
    // (title + duration mm:ss + play button) instead.
    const findArtifact = async () => await page.evaluate(() => {
      const rows = [...document.querySelectorAll('*')].filter(e => e.childElementCount <= 8 && /\b\d{1,2}:\d{2}\b/.test(e.textContent || '') && /source/i.test(e.textContent || '') && (e as HTMLElement).offsetParent) as HTMLElement[];
      const row = rows.sort((a, b) => (a.textContent || '').length - (b.textContent || '').length)[0];
      if (!row) return null;
      const r = row.getBoundingClientRect();
      if (r.width < 100 || r.x < 600) return null; // Studio panel is on the right
      return { text: (row.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 120), x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }).catch(() => null as any);

    let existing = await findArtifact();
    let triggered = !!existing;
    if (!existing) {
      if (prompt) { const cust=page.locator('button:has-text("Customize"), [aria-label*="Customize" i]').first(); if (await cust.count().catch(()=>0)) { await cust.click({timeout:6000}).catch(()=>{}); await page.waitForTimeout(2000); const ta=page.locator('textarea').last(); if (await ta.count().catch(()=>0)) await ta.fill(prompt).catch(()=>{}); } }
      const gen = page.locator('button:has-text("Audio Overview"), button:has-text("Generate"), [aria-label*="Audio Overview" i]').first();
      if (await gen.count().catch(()=>0)) { try { await gen.click({timeout:8000}); triggered=true; } catch {} }
    }
    const shot0=`${outDir}/${tsName('nlm-audio-triggered','png')}`; await page.screenshot({path:shot0,fullPage:true}); proofs.push(shot0);
    let audioUrl=''; let downloadedPath=''; let artifactText='';
    if (triggered) {
      const start=Date.now();
      while(Date.now()-start<maxWaitMs){
        const stt = await page.evaluate(()=>{ const a=[...document.querySelectorAll('audio')] as HTMLAudioElement[]; const src=a.map(x=>x.currentSrc||x.src||'').find(Boolean)||''; return { src }; });
        if (stt.src) { audioUrl=stt.src; break; }
        existing = existing || await findArtifact();
        if (existing) { artifactText = existing.text; break; }
        await page.waitForTimeout(10000);
      }
      const shot1=`${outDir}/${tsName('nlm-audio-done','png')}`; await page.screenshot({path:shot1,fullPage:true}); proofs.push(shot1);
      if (audioUrl || existing) {
        // capture audio responses at network level as backup
        const netAudio: Buffer[] = [];
        page.on('response', async (resp) => { try { const ct=(resp.headers()['content-type']||'').toLowerCase(); if (/^audio\//.test(ct) || /audio_overview|\.mp3|\.m4a|\.wav/i.test(resp.url())) { const b=await resp.body(); if (b.length>50000) netAudio.push(b); } } catch {} });
        // open artifact 3-dot menu -> Download
        try {
          // artifact row's own 3-dot: a more_vert/menu button vertically aligned with the artifact row (same y band, right of it)
          const ay = existing ? existing.y : 0;
          const menuBtn = await page.evaluate((rowY) => { const btns=[...document.querySelectorAll('button')].filter(b=>{ const el=b as HTMLElement; if(!el.offsetParent) return false; const r=el.getBoundingClientRect(); if (r.x<850) return false; const isMenu=/more_vert/.test(el.textContent||'') || /more|options|menu/i.test(el.getAttribute('aria-label')||''); if(!isMenu) return false; return rowY>0 ? Math.abs((r.y+r.height/2)-rowY)<40 : r.y>420; }) as HTMLElement[]; const b=btns[btns.length-1]; if(!b) return null; const r=b.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; }, ay).catch(()=>null as any);
          if (menuBtn) { await page.mouse.click(menuBtn.x, menuBtn.y); await page.waitForTimeout(2500); }
          const shotM=`${outDir}/${tsName('nlm-audio-menu','png')}`; await page.screenshot({path:shotM,fullPage:true}); proofs.push(shotM);
          const dl=page.locator('[role="menuitem"]:has-text("Download"), button:has-text("Download")').first();
          if (await dl.count().catch(()=>0)) { const [d]=await Promise.all([page.waitForEvent('download',{timeout:90000}).catch(()=>null as any), dl.click({timeout:6000}).catch(()=>{})]); if (d) { const sug=(d.suggestedFilename&&d.suggestedFilename())||''; const ext=sug.includes('.')?sug.slice(sug.lastIndexOf('.')+1):'m4a'; const fp=`${outDir}/${tsName('nlm-podcast',ext)}`; await d.saveAs(fp); downloadedPath=fp; } }
        } catch {}
        if (!downloadedPath && audioUrl) { const fp=`${outDir}/${tsName('nlm-podcast','mp3')}`; if (await fetchMediaFromPage(page, audioUrl, fp)) downloadedPath=fp; }
        if (!downloadedPath && !audioUrl && existing) {
          // click play to force <audio> mount, then grab its src / network audio
          await page.mouse.click(existing.x, existing.y).catch(()=>{});
          const playBtn = page.locator('button[aria-label*="play" i], button:has-text("play_arrow")').last();
          if (await playBtn.count().catch(()=>0)) await playBtn.click({timeout:5000}).catch(()=>{});
          await page.waitForTimeout(12000);
          const stt2 = await page.evaluate(()=>{ const a=[...document.querySelectorAll('audio')] as HTMLAudioElement[]; return a.map(x=>x.currentSrc||x.src||'').find(Boolean)||''; });
          if (stt2) { audioUrl = stt2; const fp=`${outDir}/${tsName('nlm-podcast','mp3')}`; if (await fetchMediaFromPage(page, stt2, fp)) downloadedPath=fp; }
          if (!downloadedPath && netAudio.length) { const big=netAudio.reduce((a,b)=>b.length>a.length?b:a); const fp=`${outDir}/${tsName('nlm-podcast','audio')}`; fs.writeFileSync(fp,big); downloadedPath=fp; }
        }
      }
    }
    return { ok:!!downloadedPath, stage:!triggered?'audio-overview-button-not-found':downloadedPath?'audio-downloaded':(audioUrl||artifactText)?'audio-ready-no-download':'audio-render-timeout', notebook:nb, artifact:artifactText||null, audioUrl:audioUrl?audioUrl.slice(0,120):null, downloadedPath:downloadedPath||null, fileInfo:downloadedPath?fileInfo(downloadedPath):null, proofs };
  }); out(!!args.json,res);
}

function usage() {
  console.log(`labgoogle — Google Labs FX CLI
Commands:
  whoami [--json]
  flow gen --prompt "..." [--image PATH] [--out DIR] [--json]
  music gen --prompt "..." [--out DIR] [--json]
  notebooklm list [--json]
  notebooklm create --title "..." [--json]
  notebooklm source add --notebook <id|title> (--url URL | --text "..." | --file PATH) [--json]
  notebooklm chat --notebook <id|title> --prompt "..." [--preset NAME | --system-file PATH] [--json]
  notebooklm audio-overview --notebook <id|title> [--prompt "..."] [--json]`);
}

(async () => {
  const { cmd, sub, args } = parseArgs(process.argv.slice(2));
  try {
    if (cmd === 'whoami') return await cmdWhoami(args);
    if (cmd === 'flow' && sub === 'gen') return await cmdFlowGen(args);
    if (cmd === 'music' && sub === 'gen') return await cmdMusicGen(args);
    if (cmd === 'notebooklm') {
      const third = process.argv.slice(2)[2] || '';
      if (sub === 'list' || sub === '') return await cmdNlmList(args);
      if (sub === 'create') return await cmdNlmCreate(args);
      if (sub === 'source' && third === 'add') return await cmdNlmSourceAdd(args);
      if (sub === 'chat') return await cmdNlmChat(args);
      if (sub === 'audio-overview') return await cmdNlmAudio(args);
      return await cmdNlmList(args);
    }
    usage();
    process.exit(cmd ? 1 : 0);
  } catch (e: any) {
    out(!!args.json, { ok: false, error: String(e?.message || e) });
    process.exit(1);
  }
})();
