const fs=require('node:fs'),assert=require('node:assert/strict')
const {chromium}=require('/home/ikhail_horokhorin/projects/o-hack/frontend/node_modules/playwright')
const root='/tmp/o-hack-sochi',base='http://127.0.0.1:18085',directory=`${root}/work/map-polish/evidence/places`
;(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'/home/ikhail_horokhorin/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']})
 const checks=[]
 try{
 for(const width of [1440,375])for(const mode of ['long','unparsed']){
  const locale=width===1440?'ru':'en',theme=width===1440?'light':'dark'
  const copy=require(`${root}/frontend/src/shared/i18n/locales/${locale}/explore.json`)
  const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'})
  await context.addInitScript(({locale,theme})=>{localStorage.setItem('app-locale',locale);localStorage.setItem('app-theme',theme);localStorage.setItem('hotel-agent-conversation','76c2fc9d-b636-4155-83f7-6d4b479eb8d1')},{locale,theme})
  await context.route('**/api/v1/places/*',async route=>{
   const response=await route.fetch();const card=await response.json()
   card.name='Veranda seaside bar with a very long name '.repeat(4)
   card.tags.name=card.name;card.tags.opening_hours=mode==='long'?'Mo-Su 10:00-17:00':'Mo-Su sunrise-sunset; PH off'
   for(const key of ['name','opening_hours'])card.facts.push({...card.facts[0],fact_id:`test-${key}`,characteristic_key:key,value:card.tags[key]})
   await route.fulfill({response,json:card})
  })
  const page=await context.newPage();page.setDefaultTimeout(45000)
  const errors=[];page.on('pageerror',error=>errors.push(error.message))
  await page.goto(base)
  const tabs=page.getByRole('group',{name:copy.panel.tabs})
  if(width===375)await tabs.getByRole('radio',{name:copy.panel.hotels,exact:true}).check()
  await page.getByRole('button',{name:'AIDA',exact:true}).first().click()
  await page.getByRole('article',{name:'AIDA',exact:true}).getByRole('button',{name:copy.details.showOnMap,exact:true}).nth(1).click()
  const map=page.getByRole('region',{name:copy.map.title,exact:true}),routes=map.locator('button[data-kind="route"]')
  await page.waitForFunction(()=>document.querySelectorAll('button[data-kind="route"]').length===5)
  const labels=await routes.locator('[data-map-label]').evaluateAll(elements=>elements.filter(el=>getComputedStyle(el).visibility==='visible').length)
  assert.ok(labels<=2)
  await routes.first().press('Enter')
  const card=page.getByRole('region',{name:copy.place.title,exact:true})
  await card.getByText(mode==='long'?copy.place.open:copy.place.unparsed,{exact:true}).waitFor()
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
  await card.getByText(copy.status.active,{exact:true}).first().waitFor()
  await page.screenshot({path:`${directory}/edge-${width}-${mode}.png`,animations:'disabled'})
  if(mode==='long'){
   if(width===375)await tabs.getByRole('radio',{name:copy.panel.map,exact:true}).check()
   await map.locator('[class*="bottomStart"] button[aria-expanded]').first().press('Enter')
   await page.getByRole('button',{name:copy.weather.nextHour,exact:true}).press('Enter')
   await page.keyboard.press('Escape')
   if(width===375)await tabs.getByRole('radio',{name:copy.panel.hotels,exact:true}).check()
   await card.getByText(copy.place.closed,{exact:true}).waitFor()
  }else{
   assert.equal(await card.getByText(copy.place.open,{exact:true}).count(),0)
   assert.equal(await card.getByText(copy.place.closed,{exact:true}).count(),0)
  }
  assert.deepEqual(errors,[])
  const check={width,locale,theme,mode,realRouteCount:5,persistentLabels:labels,overflow:false,activeStatus:true,timeBinding:mode==='long',errors}
  checks.push(check);fs.writeFileSync(`${directory}/edge-checks.json`,JSON.stringify(checks,null,2));console.log(JSON.stringify(check))
  await context.close()
 }
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1})
