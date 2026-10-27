import { chromium } from 'playwright';
const CDP = process.env.LABGOOGLE_CDP || 'http://127.0.0.1:18899';
const browser = await chromium.connectOverCDP(CDP);
const ctx = browser.contexts()[0];
const pages = ctx.pages();
let page = pages.find(p => p.url().includes('/flow/project/')) || pages[0];
console.log('URL:', page.url());

// Find the approval ROW: a clickable div whose text is exactly 'Approve' AND has a sibling checkmark,
// width in the ~200-360 range (the highlighted row), located in the sidebar.
const cands = await page.evaluate(() => {
  const out=[];
  const els=[...document.querySelectorAll('div,button')];
  for(const e of els){
    const t=(e.textContent||'').trim();
    if(t!=='Approve') continue;
    const r=e.getBoundingClientRect();
    if(r.height<=0||r.width<=0) continue;
    // prefer elements on-screen in sidebar (x>900), reasonable button height
    out.push({cx:Math.round(r.x+r.width/2),cy:Math.round(r.y+r.height/2),w:Math.round(r.width),h:Math.round(r.height),x:Math.round(r.x),cursor:getComputedStyle(e).cursor,cls:(typeof e.className==='string'?e.className.slice(0,30):'')});
  }
  return out;
});
console.log('Approve candidates:', JSON.stringify(cands,null,1));

// Pick the row-style one: x in sidebar, y near 399 area, width 150-360
const row = cands.find(c=>c.x>900 && c.w>=150 && c.w<=380 && c.h>=28 && c.h<=60) || cands[0];
if(!row){ console.log('NO ROW'); await browser.close(); process.exit(2);}
console.log('CLICK TARGET:', JSON.stringify(row));
await page.mouse.move(row.cx,row.cy);
await page.waitForTimeout(200);
await page.mouse.down(); await page.waitForTimeout(70); await page.mouse.up();
console.log('clicked', row.cx, row.cy);
await page.waitForTimeout(3000);

const state = await page.evaluate(()=>{
  const approveVisible=[...document.querySelectorAll('div,button')].some(e=>(e.textContent||'').trim()==='Approve'&&e.getBoundingClientRect().height>0);
  const bodyTxt=document.body.innerText.slice(-1200);
  return {approveVisible, tail:bodyTxt};
});
console.log('APPROVE_STILL_VISIBLE:', state.approveVisible);
console.log('BODY_TAIL:', state.tail.replace(/\n+/g,' | '));
const shot='out/vidcdp/do-approve2-'+Date.now()+'.png';
await page.screenshot({path:shot}).catch(()=>{});
console.log('shot:',shot);
await browser.close();
