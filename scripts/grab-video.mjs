import { chromium } from 'playwright';
import fs from 'fs';
const CDP = process.env.LABGOOGLE_CDP || 'http://127.0.0.1:18899';
const browser = await chromium.connectOverCDP(CDP);
const ctx = browser.contexts()[0];
const pages = ctx.pages();
let page = pages.find(p => p.url().includes('/flow/project/')) || pages[0];
console.log('URL:', page.url());

// Collect any <video> src and any blob/googleusercontent mp4 urls present in DOM
const media = await page.evaluate(() => {
  const out = { videos: [], sources: [] };
  document.querySelectorAll('video').forEach(v=>{
    out.videos.push({ src: v.currentSrc||v.src||'', poster: v.poster||'', dur: v.duration||0, w:v.videoWidth, h:v.videoHeight });
    v.querySelectorAll('source').forEach(s=>out.sources.push(s.src));
  });
  return out;
});
console.log('MEDIA:', JSON.stringify(media,null,1));

// Try to sniff network for mp4 by scanning performance entries
const perf = await page.evaluate(()=>{
  return performance.getEntriesByType('resource')
    .map(e=>e.name)
    .filter(u=>/\.mp4|videoplayback|\/video\//i.test(u))
    .slice(-15);
});
console.log('PERF_MP4:', JSON.stringify(perf,null,1));
await browser.close();
