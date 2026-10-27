import { chromium } from 'playwright';
import fs from 'fs';
const CDP = process.env.LABGOOGLE_CDP || 'http://127.0.0.1:18899';
const url = process.argv[2];
const outPath = process.argv[3] || ('out/vidcdp/tro-first-'+Date.now()+'.mp4');
if(!url){ console.log('need url'); process.exit(1);}
const browser = await chromium.connectOverCDP(CDP);
const ctx = browser.contexts()[0];
const page = ctx.pages().find(p=>p.url().includes('/flow/'))||ctx.pages()[0];

// Fetch inside page context (uses session cookies), read as base64
const b64 = await page.evaluate(async (u)=>{
  const r = await fetch(u, {credentials:'include'});
  if(!r.ok) return {err:'http '+r.status};
  const buf = await r.arrayBuffer();
  let binary=''; const bytes=new Uint8Array(buf);
  const chunk=0x8000;
  for(let i=0;i<bytes.length;i+=chunk){ binary+=String.fromCharCode.apply(null,bytes.subarray(i,i+chunk)); }
  return { data: btoa(binary), len: bytes.length, type: r.headers.get('content-type') };
}, url);
if(b64.err){ console.log('FETCH_ERR:', b64.err); await browser.close(); process.exit(2);}
fs.writeFileSync(outPath, Buffer.from(b64.data,'base64'));
console.log('WROTE', outPath, 'bytes='+b64.len, 'type='+b64.type);
await browser.close();
