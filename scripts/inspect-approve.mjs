import { chromium } from 'playwright';

const CDP = process.env.LABGOOGLE_CDP || 'http://127.0.0.1:18899';

const browser = await chromium.connectOverCDP(CDP);
const ctx = browser.contexts()[0];
const pages = ctx.pages();
let page = pages.find(p => p.url().includes('/flow/project/')) || pages[0];
console.log('URL:', page.url());

// Find any element whose visible text is exactly/contains "Approve" (not "do not ask")
const info = await page.evaluate(() => {
  const out = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
  const seen = new Set();
  let n;
  while ((n = walker.nextNode())) {
    const txt = (n.textContent || '').trim();
    // direct approve rows
    if (/^Approve$/.test(txt) || /^Approve, do not ask again$/.test(txt) || /^Reject$/.test(txt)) {
      const r = n.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      const key = n.tagName + '|' + txt + '|' + Math.round(r.x) + ',' + Math.round(r.y);
      if (seen.has(key)) continue;
      seen.add(key);
      // walk up to find clickable ancestor
      let anc = n, chain = [];
      for (let i=0;i<5 && anc;i++){
        chain.push(anc.tagName.toLowerCase() + (anc.getAttribute('role')?('[role='+anc.getAttribute('role')+']'):'') + (anc.getAttribute('aria-label')?('[al='+anc.getAttribute('aria-label')+']'):'') + (anc.onclick?'(onclick)':'') + (anc.className && typeof anc.className==='string'?('.'+anc.className.split(' ').slice(0,2).join('.')):''));
        anc = anc.parentElement;
      }
      out.push({
        tag: n.tagName, role: n.getAttribute('role'), text: txt.slice(0,40),
        rect: {x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height),cx:Math.round(r.x+r.width/2),cy:Math.round(r.y+r.height/2)},
        cursor: getComputedStyle(n).cursor,
        chain: chain.join(' < ')
      });
    }
  }
  return out;
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
