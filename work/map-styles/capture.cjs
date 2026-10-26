const fs=require('fs');const {chromium}=require(process.env.PLAYWRIGHT_MODULE||require('path').resolve(__dirname,'../../frontend/node_modules/playwright'));
const root=require('path').resolve(__dirname,'evidence');
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const result=[];
for(const width of [1440,375])for(const [index,style] of ['clean','toy','iso','sunset','neon'].entries()){
 const page=await browser.newPage({viewport:{width,height:width===375?812:1000},deviceScaleFactor:width===375?2:1,reducedMotion:'reduce'});const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url())});
 await page.goto(`http://127.0.0.1:8090/0${index+1}-${style}.html`);await page.waitForFunction(()=>window.mapPrototype?.metrics);await page.waitForTimeout(1200);
 for(const camera of ['overview','street','balcony']){
  await page.locator(`[data-camera="${camera}"]`).click();await page.waitForTimeout(style==='sunset'?1700:900);
  await page.screenshot({path:`${root}/${style}-${width}-${camera}.png`});
  const state=await page.evaluate(()=>({metrics:window.mapPrototype.metrics,firstFrameMs:window.mapPrototype.firstFrameMs,props:window.mapPrototype.propInventory,shadowWorkerMs:window.mapPrototype.shadowWorkerMs,notice:document.querySelector('#notice').textContent,overflow:document.documentElement.scrollWidth>innerWidth,center:window.mapPrototype.map.getCenter().toArray()}));
  result.push({style,width,camera,errors:[...new Set(errors)],...state});fs.writeFileSync(root+'/browser-matrix.json',JSON.stringify(result,null,2));console.log(style,width,camera,'errors',errors.length)
 }
 await page.close()
}
await browser.close()})();
