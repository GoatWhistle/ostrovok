const {chromium}=require('/home/ikhail_horokhorin/projects/o-hack-sochi/frontend/node_modules/playwright');
const fs=require('node:fs');
(async()=>{
const browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:375,height:900},reducedMotion:'reduce'});
await page.addInitScript(()=>{localStorage.setItem('factmap-map-appearance','neon');localStorage.setItem('app-locale','en')});const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{window.__workers={active:0,created:0,post:0};const Native=window.Worker;window.Worker=class extends Native {constructor(url,options){super(url,options);this.night=String(url).includes('window-worker');if(this.night){window.__workers.active++;window.__workers.created++}}postMessage(...args){if(this.night)window.__workers.post++;return super.postMessage(...args)}terminate(){if(this.night){window.__workers.active--;this.night=false}return super.terminate()}};window.__frames=0;const raf=requestAnimationFrame;window.requestAnimationFrame=(cb)=>raf(t=>{window.__frames++;cb(t)})});
await page.goto('http://127.0.0.1:5179/?chat=e665bb3e-121a-479a-b511-34a696f3dd85&hotel=n4712092442&tab=map');
await page.locator('.maplibregl-map').waitFor();
await page.waitForFunction(()=>{
 const el=document.querySelector('.maplibregl-map');
 let f=el?.[Object.keys(el).find(k=>k.startsWith('__reactFiber'))];
 while(f){let h=f.memoizedState;let count=0;while(h&&count++<100){const v=h.memoizedState;if(v?.current?.getStyle&&v.current?.jumpTo){window.__evolutionMap=v.current;return !!v.current.getSource('sochi-map')}h=h.next}f=f.return}
 return false;
},{timeout:30000});
page.setDefaultTimeout(20000);
const report={errors,cycles:[],sceneRequests:[]};
page.on('request',r=>{if(r.url().includes('/map/scene?'))report.sceneRequests.push(r.url())});
await page.waitForFunction(()=>document.querySelector('[data-map-active]')?.dataset.mapActive==='true');
await page.evaluate(()=>window.__evolutionMap.jumpTo({center:[39.9668263,43.3989565],zoom:16.5,pitch:0,bearing:23}));
await page.waitForFunction(()=>window.__workers.active>0,{timeout:30000});
await page.waitForTimeout(2000);
await page.evaluate(()=>{const m=window.__evolutionMap;window.__camera=JSON.stringify([m.getCenter(),m.getZoom(),m.getPitch(),m.getBearing()]);window.__renders=0;m.on('render',()=>window.__renders++);});
for(let i=0;i<10;i++){
 await page.getByRole('radio',{name:'Chat',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('[data-map-active]')?.dataset.mapActive==='false'&&window.__workers.active===0);
 await page.getByRole('radio',{name:'Map',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('[data-map-active]')?.dataset.mapActive==='true');
 report.cycles.push(await page.evaluate(()=>{const m=window.__evolutionMap;return {camera:window.__camera===JSON.stringify([m.getCenter(),m.getZoom(),m.getPitch(),m.getBearing()]),canvases:document.querySelectorAll('.maplibregl-canvas').length,connected:m.getCanvas().isConnected}}));
 console.log('cycle',i);
}
await page.getByRole('radio',{name:'Chat',exact:true}).click();
await page.waitForFunction(()=>document.querySelector('[data-map-active]')?.dataset.mapActive==='false'&&window.__workers.active===0);
await page.waitForTimeout(3000);const count=report.sceneRequests.length;
const before=await page.evaluate(()=>({workers:{...window.__workers},renders:window.__renders,frames:window.__frames}));
await page.waitForTimeout(30000);
const after=await page.evaluate(()=>({workers:{...window.__workers},renders:window.__renders,frames:window.__frames}));
report.hidden={before,after,sceneRequests:report.sceneRequests.length-count};
await page.getByRole('radio',{name:'Map',exact:true}).click();await page.waitForFunction(()=>document.querySelector('[data-map-active]')?.dataset.mapActive==='true');
await page.evaluate(()=>{const m=window.__evolutionMap;window.__lose=m.getCanvas().getContext('webgl2').getExtension('WEBGL_lose_context');window.__lose.loseContext()});
await page.getByText('3D map is unavailable',{exact:true}).waitFor();
await page.evaluate(()=>window.__lose.restoreContext());
await page.waitForFunction(()=>document.querySelector('[data-map-active]')?.dataset.mapActive==='true',{timeout:30000});
report.contextRestored=await page.evaluate(()=>({sameCanvas:window.__evolutionMap.getCanvas().isConnected,count:document.querySelectorAll('.maplibregl-canvas').length}));
await page.evaluate(()=>{window.__evolutionMap.getContainer().style.transform='translateY(2000px)'});
await page.waitForFunction(()=>document.querySelector('[data-map-active]')?.dataset.mapActive==='false');
await page.evaluate(()=>{window.__evolutionMap.getContainer().style.transform=''});
await page.waitForFunction(()=>document.querySelector('[data-map-active]')?.dataset.mapActive==='true');
report.offscreen=true;
const prior=page.url();await page.locator('header a').first().click();await page.waitForFunction(()=>document.querySelector('[data-map-active]')?.dataset.mapActive==='false');
report.landing=await page.evaluate(()=>({same:window.__evolutionMap.getCanvas().isConnected,contexts:document.querySelectorAll('.maplibregl-canvas').length}));
await page.goBack({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.querySelector('[data-map-active]')?.dataset.mapActive==='true');
report.returned=await page.evaluate(()=>({same:window.__evolutionMap.getCanvas().isConnected,camera:window.__camera===JSON.stringify([window.__evolutionMap.getCenter(),window.__evolutionMap.getZoom(),window.__evolutionMap.getPitch(),window.__evolutionMap.getBearing()]),contexts:document.querySelectorAll('.maplibregl-canvas').length}));

fs.writeFileSync('/home/ikhail_horokhorin/projects/o-hack-sochi/work/frontend-evolution/evidence/e08-browser.json',JSON.stringify(report,null,2));
if(report.cycles.some(c=>!c.camera||!c.connected||c.canvases!==1)||!report.returned.same||!report.returned.camera||report.hidden.sceneRequests||after.renders!==before.renders||after.workers.post!==before.workers.post||after.workers.active)throw new Error('Hidden map invariant failed');
await page.screenshot({path:'/home/ikhail_horokhorin/projects/o-hack-sochi/work/frontend-evolution/evidence/e08-restored-mobile.png',timeout:60000});
console.log(JSON.stringify(report));await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
