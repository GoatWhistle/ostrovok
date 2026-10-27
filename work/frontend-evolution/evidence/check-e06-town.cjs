const {chromium}=require('/home/ikhail_horokhorin/projects/o-hack-sochi/frontend/node_modules/playwright');
const fs=require('node:fs');
(async()=>{
const browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'});
await page.addInitScript(()=>{localStorage.setItem('factmap-map-appearance','toy-town');localStorage.setItem('app-locale','ru')});const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:5179/?chat=e665bb3e-121a-479a-b511-34a696f3dd85');
await page.locator('.maplibregl-map').waitFor();
await page.waitForFunction(()=>{
 const el=document.querySelector('.maplibregl-map');
 let f=el?.[Object.keys(el).find(k=>k.startsWith('__reactFiber'))];
 while(f){let h=f.memoizedState;let count=0;while(h&&count++<100){const v=h.memoizedState;if(v?.current?.getStyle&&v.current?.jumpTo){window.__evolutionMap=v.current;return !!v.current.getSource('sochi-map')}h=h.next}f=f.return}
 return false;
},{timeout:30000});
const report=[];
for(const z of [14.99,16.2]){
 await page.evaluate(z=>window.__evolutionMap.jumpTo({center:[39.7233,43.5855],zoom:z,pitch:55,bearing:0}),z);
 await page.waitForTimeout(1500);
 await page.waitForFunction(()=>window.__evolutionMap.areTilesLoaded(),{timeout:30000});
 const data=await page.evaluate(()=>{const m=window.__evolutionMap;return {z:m.getZoom(),pitch:m.getPitch(),roofs:m.getStyle().layers.filter(l=>l.id.startsWith('toy-')).map(l=>l.id),glow:m.getLayoutProperty('base-roads-glow','visibility'),buildings:m.queryRenderedFeatures({layers:['base-buildings']}).length,source:m.querySourceFeatures('sochi-map',{sourceLayer:'buildings'}).length,layers:m.getStyle().layers.map(l=>({id:l.id,minzoom:l.minzoom,maxzoom:l.maxzoom}))}});
 report.push(data);
 await page.screenshot({path:`/home/ikhail_horokhorin/projects/o-hack-sochi/work/frontend-evolution/evidence/e06-${process.argv[2]||'before'}-center-z${z}.png`});
}
fs.writeFileSync(`/home/ikhail_horokhorin/projects/o-hack-sochi/work/frontend-evolution/evidence/e06-${process.argv[2]||'before'}.json`,JSON.stringify({report,errors},null,2));
console.log(JSON.stringify(report.map(({z,buildings,source})=>({z,buildings,source}))));
await browser.close();
})().catch(e=>{console.error(e);process.exitCode=1});
