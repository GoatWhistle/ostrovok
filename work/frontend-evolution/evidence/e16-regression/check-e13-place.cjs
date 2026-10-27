const fs=require('node:fs')
const assert=require('node:assert/strict')
const {chromium}=require('/home/ikhail_horokhorin/projects/o-hack-sochi/frontend/node_modules/playwright')
const root='/home/ikhail_horokhorin/projects/o-hack-sochi'
const t=require(`${root}/frontend/src/shared/i18n/locales/ru/explore.json`)
const chat=require(`${root}/work/frontend-evolution/evidence/e12-conversation.json`).id
const out='/home/ikhail_horokhorin/projects/o-hack-sochi/work/frontend-evolution/evidence/e16-regression/e13';fs.mkdirSync(out,{recursive:true})
;(async()=>{
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']})
const rows=[]
try{for(const style of ['neon','toy-town']){
const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'})
page.setDefaultTimeout(30000)
const row={style,errors:[],filterErrors:[],searches:[],places:[]};rows.push(row)
page.on('pageerror',e=>row.errors.push(e.message))
page.on('console',m=>{if(m.type()==='error'&&/filter|Expected .*found/.test(m.text()))row.filterErrors.push(m.text())})
page.on('request',r=>{if(r.url().endsWith('/search')||r.url().endsWith('/chat/messages'))row.searches.push(r.url());if(r.url().includes('/places/'))row.places.push(r.url())})
await page.addInitScript(()=>{localStorage.setItem('app-locale','ru');localStorage.setItem('app-theme','dark')})
await page.goto(`http://127.0.0.1:5179/?chat=${chat}&hotel=n11331531334&map=full&tab=map&style=${style}`,{waitUntil:'domcontentloaded'})
await page.locator('[data-map-hotel]').waitFor();console.log('card '+style)
await page.waitForFunction(()=>document.querySelector('[data-map-active=true]'));console.log('map '+style)
await page.evaluate(()=>{
 const el=document.querySelector('[data-map-hotel]')
 let fiber=el[Object.keys(el).find(k=>k.startsWith('__reactFiber'))]
 while(fiber){if(fiber.memoizedProps?.state?.openPlace){fiber.memoizedProps.state.openPlace('n12925923430');return}fiber=fiber.return}
 throw Error('Map hotel controller missing')
})
const card=page.locator('[data-map-hotel]').getByRole('region',{name:t.place.title,exact:true})
await card.getByText('Space',{exact:true}).waitFor()
await card.getByRole('button',{name:t.place.showRoute,exact:true}).click()
await page.waitForTimeout(800)
row.route=await page.evaluate(()=>{
 let fiber=document.querySelector('[data-map-active]');fiber=fiber[Object.keys(fiber).find(k=>k.startsWith('__reactFiber'))]
 while(fiber){let hook=fiber.memoizedState;for(let i=0;hook&&i<100;i++,hook=hook.next){const map=hook.memoizedState?.current;if(map?.getSource&&map?.getCenter){const source=map.getSource('routes')?._data;return (source?.geojson??source)?.features?.map(f=>f.id)}}fiber=fiber.return}
 return []
})
row.card=await card.textContent();row.url=page.url()
await page.addStyleTag({content:'canvas { visibility: hidden !important }'}); await page.screenshot({path:`${out}/${style}-place.png`,timeout:10000}).catch(e=>{row.captureFailure=e.message})
assert.ok(row.route.some(id=>String(id).includes('n12925923430')))
assert.equal(row.searches.length,0);assert.deepEqual(row.errors,[]);assert.deepEqual(row.filterErrors,[])
await card.getByRole('button',{name:t.place.back,exact:true}).click()
await page.getByRole('button',{name:t.surfaces.openHotelPage,exact:true}).waitFor()
console.log(JSON.stringify(row));await page.close()
}}finally{fs.writeFileSync(`${out}/results.json`,JSON.stringify(rows,null,2));await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1})
