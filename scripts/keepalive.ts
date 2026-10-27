import { chromium } from 'playwright';
(async()=>{
 const dir='/root/.openclaw/workspace/google-flow-vps-profile';
 const ctx=await chromium.launchPersistentContext(dir,{headless:true,args:['--no-sandbox'],viewport:{width:1280,height:800},locale:'en-US',timezoneId:'America/Los_Angeles'});
 const p=ctx.pages()[0]||await ctx.newPage();
 await p.goto('https://labs.google/fx/tools/flow',{waitUntil:'domcontentloaded',timeout:60000});
 await p.waitForTimeout(7000);
 let acct=''; try{const r=await p.context().request.get('https://labs.google/fx/api/auth/session'); acct=await r.text();}catch(e){}
 const HINT=process.env.LABGOOGLE_ACCOUNT||''; const ok=/"email"\s*:/.test(acct) || (HINT ? acct.includes(HINT) : false);
 await ctx.storageState({path:'/root/.openclaw/workspace/google-flow-vps-storage-state.json'});
 console.log(JSON.stringify({keepalive:true,signedIn:ok,ts:new Date().toISOString()}));
 await ctx.close();
})();
