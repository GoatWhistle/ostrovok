const {chromium}=require('/home/ikhail_horokhorin/projects/o-hack-sochi/frontend/node_modules/playwright');
const fs=require('node:fs');
(async()=>{
const browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'});
await page.addInitScript(()=>{if(!localStorage.getItem('factmap-map-appearance'))localStorage.setItem('factmap-map-appearance','toy-town');if(!localStorage.getItem('app-locale'))localStorage.setItem('app-locale','ru')});const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:5179/?chat=e665bb3e-121a-479a-b511-34a696f3dd85&hotel=n4712092442');
await page.locator('.maplibregl-map').waitFor();
await page.waitForFunction(()=>{
 const el=document.querySelector('.maplibregl-map');
 let f=el?.[Object.keys(el).find(k=>k.startsWith('__reactFiber'))];
 while(f){let h=f.memoizedState;let count=0;while(h&&count++<100){const v=h.memoizedState;if(v?.current?.getStyle&&v.current?.jumpTo){window.__evolutionMap=v.current;return !!v.current.getSource('sochi-map')}h=h.next}f=f.return}
 return false;
},{timeout:30000});
page.setDefaultTimeout(15000);await page.waitForTimeout(2000);await page.evaluate(()=>window.__evolutionMap.jumpTo({zoom:14.5,pitch:45,bearing:23}));console.log('map ready');const report={errors, switches:[], posts:[]};page.on('request',r=>{if(r.method()==='POST')report.posts.push(r.url())});
await page.evaluate(()=>{const m=window.__evolutionMap;window.__sources=Object.fromEntries(Object.keys(m.getStyle().sources).map(k=>[k,m.getSource(k)]));window.__camera=JSON.stringify([m.getCenter(),m.getZoom(),m.getPitch(),m.getBearing()])});
await page.getByRole('button',{name:'Оформление карты',exact:true}).click();
for(let i=0;i<10;i++){
 const id=i%2?'toy-town':'neon';await page.getByRole('radio',{name:i%2?'Игрушечный город':'Ночной город',exact:true}).click();
 await page.waitForFunction(id=>new URL(location.href).searchParams.get('style')===id,id);
 console.log('switch',i,id);report.switches.push(await page.evaluate(()=>{const m=window.__evolutionMap;return {id:document.documentElement.dataset.mapAppearance,camera:window.__camera===JSON.stringify([m.getCenter(),m.getZoom(),m.getPitch(),m.getBearing()]),sources:Object.entries(window.__sources).every(([k,v])=>m.getSource(k)===v)}}));
}
fs.writeFileSync('/tmp/e07-switches.json',JSON.stringify(report));report.timings=await page.evaluate(async()=>{const api=await import(performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname==='/src/shared/theme/map-appearance.ts')?.name??'/src/shared/theme/map-appearance.ts');return Array.from({length:10},(_,i)=>{const t=performance.now();api.requestMapAppearance(i%2?'toy-town':'neon');return performance.now()-t})});
await page.evaluate(async()=>{const api=await import(performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname==='/src/shared/theme/map-appearance.ts')?.name??'/src/shared/theme/map-appearance.ts');window.__removeFailure=api.registerMapAppearance({applyAppearance:id=>{if(id==='neon')throw new Error('Test material error')}})});
await page.getByRole('radio',{name:'Ночной город',exact:true}).click();await page.getByRole('alert').waitFor();
console.log('rollback visible');report.rollback=await page.evaluate(()=>({id:document.documentElement.dataset.mapAppearance,url:new URL(location.href).searchParams.get('style')}));
await page.evaluate(()=>window.__removeFailure());await page.getByRole('button',{name:'Повторить смену'}).click();
await page.waitForFunction(()=>new URL(location.href).searchParams.get('style')==='neon');
await page.keyboard.press('Escape');
await page.getByRole('button',{name:'Настройки',exact:true}).click();await page.getByRole('radio',{name:'Тёмная',exact:true}).click();await page.getByRole('radio',{name:'Английский',exact:true}).click();await page.keyboard.press('Escape');
report.preferences=await page.evaluate(()=>({appearance:document.documentElement.dataset.mapAppearance,theme:document.documentElement.dataset.theme,lang:document.documentElement.lang,hotel:new URL(location.href).searchParams.get('hotel')}));
await page.getByRole('button',{name:'Map appearance',exact:true}).click();await page.getByRole('radio',{name:'Toy town',exact:true}).click();await page.keyboard.press('Escape');
fs.writeFileSync('/tmp/e07-before-reload.json',JSON.stringify(report));console.log('reload');await page.reload({waitUntil:'domcontentloaded',timeout:60000});await page.getByRole('button',{name:'Map appearance',exact:true}).click();
report.reload=await page.getByRole('radio',{name:'Toy town',exact:true}).isChecked();
await page.screenshot({path:'/home/ikhail_horokhorin/projects/o-hack-sochi/work/frontend-evolution/evidence/e07-picker-desktop.png',timeout:60000});
await page.setViewportSize({width:375,height:900});await page.keyboard.press('Escape');await page.getByRole('radio',{name:'Map',exact:true}).click();await page.getByRole('button',{name:'Map appearance',exact:true}).click();
report.touch=await page.getByRole('button',{name:'Map appearance',exact:true}).boundingBox();await page.screenshot({path:'/home/ikhail_horokhorin/projects/o-hack-sochi/work/frontend-evolution/evidence/e07-picker-mobile.png',timeout:60000});
fs.writeFileSync('/home/ikhail_horokhorin/projects/o-hack-sochi/work/frontend-evolution/evidence/e07-browser.json',JSON.stringify(report,null,2));
if(report.posts.length||report.switches.some(v=>!v.camera||!v.sources)||!report.reload)throw new Error('State invariant failed');
console.log(JSON.stringify(report));await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
