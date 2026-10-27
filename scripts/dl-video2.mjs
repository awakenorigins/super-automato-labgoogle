import { chromium } from 'playwright';
import fs from 'fs';
const CDP = process.env.LABGOOGLE_CDP || 'http://127.0.0.1:18899';
const url = process.argv[2];
const outPath = process.argv[3] || ('out/vidcdp/tro-first-'+Date.now()+'.mp4');
const browser = await chromium.connectOverCDP(CDP);
const ctx = browser.contexts()[0];

// Use APIRequestContext bound to the browser context cookies
const cookies = await ctx.cookies();
// open a fresh page, go to the redirect URL, capture final URL + response
const page = await ctx.newPage();
let finalUrl=null, ct=null, status=null, bodyLen=0;
page.on('response', resp=>{
  const u=resp.url();
  if(/mp4|videoplayback|getMediaUrlRedirect/i.test(u)){
    console.log('resp', resp.status(), (resp.headers()['content-type']||''), u.slice(0,120));
  }
});
try{
  const resp = await page.goto(url, {waitUntil:'commit', timeout:30000});
  finalUrl = page.url();
  console.log('FINAL_URL:', finalUrl.slice(0,160));
}catch(e){ console.log('goto note:', e.message.slice(0,80)); finalUrl=page.url(); }

// Now fetch the final (same-origin googlevideo) via request context
try{
  const r = await page.context().request.get(finalUrl);
  status=r.status(); ct=r.headers()['content-type'];
  const buf = await r.body();
  bodyLen=buf.length;
  fs.writeFileSync(outPath, buf);
  console.log('WROTE', outPath, 'status='+status, 'type='+ct, 'bytes='+bodyLen);
}catch(e){ console.log('req err', e.message.slice(0,120)); }
await page.close();
await browser.close();
