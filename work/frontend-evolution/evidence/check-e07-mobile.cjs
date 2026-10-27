const {chromium}=require('/home/ikhail_horokhorin/projects/o-hack-sochi/frontend/node_modules/playwright');
const fs=require('node:fs');
(async()=>{
const browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:375,height:900},reducedMotion:'reduce'});
await page.addInitScript(()=>{if(!localStorage.getItem('factmap-map-appearance'))localStorage.setItem('factmap-map-appearance','neon');localStorage.setItem('app-locale','en');localStorage.setItem('app-theme','dark')});const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:5179/?chat=e665bb3e-121a-479a-b511-34a696f3dd85&hotel=n4712092442&style=unknown&tab=map');
await page.locator('.maplibregl-map').waitFor();
await page.waitForFunction(()=>{
 const el=document.querySelector('.maplibregl-map');
 let f=el?.[Object.keys(el).find(k=>k.startsWith('__reactFiber'))];
 while(f){let h=f.memoizedState;let count=0;while(h&&count++<100){const v=h.memoizedState;if(v?.current?.getStyle&&v.current?.jumpTo){window.__evolutionMap=v.current;return !!v.current.getSource('sochi-map')}h=h.next}f=f.return}
 return false;
},{timeout:30000});
page.setDefaultTimeout(20000);
const report=JSON.parse(fs.readFileSync('/tmp/e07-before-reload.json','utf8'));
report.unknown=await page.evaluate(()=>({id:document.documentElement.dataset.mapAppearance,url:new URL(location.href).searchParams.get('style')}));
await page.getByRole('button',{name:'Map appearance',exact:true}).click();await page.getByRole('radio',{name:'Toy town',exact:true}).click();
await page.waitForFunction(()=>new URL(location.href).searchParams.get('style')==='toy-town');
report.stored=await page.evaluate(()=>localStorage.getItem('factmap-map-appearance'));
await page.goto('http://127.0.0.1:5179/?chat=e665bb3e-121a-479a-b511-34a696f3dd85&hotel=n4712092442&tab=map',{waitUntil:'domcontentloaded',timeout:60000});
await page.getByRole('button',{name:'Map appearance',exact:true}).click();report.reload=await page.getByRole('radio',{name:'Toy town',exact:true}).isChecked();
report.touch=await page.getByRole('button',{name:'Map appearance',exact:true}).boundingBox();
report.overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
fs.writeFileSync('/home/ikhail_horokhorin/projects/o-hack-sochi/work/frontend-evolution/evidence/e07-browser.json',JSON.stringify(report,null,2));
await page.screenshot({path:'/home/ikhail_horokhorin/projects/o-hack-sochi/work/frontend-evolution/evidence/e07-picker-mobile.png',timeout:60000});
if(!report.reload||report.overflow||report.touch.width<44||report.touch.height<44||report.unknown.url!==null)throw new Error('Mobile control failed');
console.log(JSON.stringify(report));await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
