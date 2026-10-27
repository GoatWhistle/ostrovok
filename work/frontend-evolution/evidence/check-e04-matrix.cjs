const {chromium}=require('/home/ikhail_horokhorin/projects/o-hack-sochi/frontend/node_modules/playwright');
const fs=require('node:fs');
const assert=require('node:assert/strict');
(async()=>{
const browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const rows=[];
try{
for(const [width,theme,locale] of [[1440,'dark','ru'],[375,'light','en']]){
 const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
 await context.addInitScript(({theme,locale})=>{localStorage.setItem('app-theme',theme);localStorage.setItem('app-locale',locale)}, {theme,locale});
 const page=await context.newPage(); const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5179/?chat=e665bb3e-121a-479a-b511-34a696f3dd85&tab=map');
 await page.locator('.maplibregl-map').waitFor();
 await page.waitForFunction(()=>{
  const el=document.querySelector('.maplibregl-map');let f=el?.[Object.keys(el).find(k=>k.startsWith('__reactFiber'))];
  while(f){let h=f.memoizedState;let count=0;while(h&&count++<100){const v=h.memoizedState;if(v?.current?.getStyle&&v.current?.jumpTo){window.__evolutionMap=v.current;return !!v.current.getSource('sochi-map')}h=h.next}f=f.return}return false;
 });
 const scene=locale==='ru'?'Солнце и погода':'Sun and weather';
 await page.getByRole('button',{name:new RegExp(scene)}).click();
 const later=locale==='ru'?'На час позже':'An hour later';
 const earlier=locale==='ru'?'На час раньше':'An hour earlier';
 const target=width===375?20:12;
 for(let hour=16;hour!==target;hour+=target>16?1:-1){await page.getByRole('button',{name:target>16?later:earlier,exact:true}).click()}
 await page.keyboard.press('Escape');
 for(const z of [10,12,14.99,15,15.01,16]){
  await page.evaluate(z=>window.__evolutionMap.jumpTo({center:[39.7233,43.5855],zoom:z,pitch:55,bearing:0}),z);
  await page.waitForTimeout(1200);
  await page.waitForFunction(()=>window.__evolutionMap.areTilesLoaded());
  const result=await page.evaluate(()=>{const m=window.__evolutionMap;return {zoom:m.getZoom(),flat:m.queryRenderedFeatures({layers:['base-buildings']}).length,volumes:m.queryRenderedFeatures({layers:['overview-volumes']}).length,pitch:m.getPitch()}});
  assert(result.flat>0,`buildings missing at ${z}`);rows.push({width,theme,locale,hour:target,...result});fs.writeFileSync('/home/ikhail_horokhorin/projects/o-hack-sochi/work/frontend-evolution/evidence/e04-matrix.json',JSON.stringify(rows,null,2));
  if(z===15.01)await page.screenshot({path:`/home/ikhail_horokhorin/projects/o-hack-sochi/work/frontend-evolution/evidence/e04-${width}-${theme}-${locale}-pitch55.png`});
 }
 const low=await page.evaluate(async()=>{const {applyQuality}=await import('/src/shared/geo/map-quality.ts');applyQuality(window.__evolutionMap,3);return {flat:window.__evolutionMap.queryRenderedFeatures({layers:['base-buildings']}).length,volume:window.__evolutionMap.getLayoutProperty('overview-volumes','visibility')}});
 assert(low.flat>0);assert.equal(low.volume,'none');assert.deepEqual(errors,[]);rows.push({width,quality:3,...low,errors});
 await context.close();fs.writeFileSync('/home/ikhail_horokhorin/projects/o-hack-sochi/work/frontend-evolution/evidence/e04-matrix.json',JSON.stringify(rows,null,2));
}
console.log(JSON.stringify(rows));
}finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
