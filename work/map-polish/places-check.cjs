const fs = require('node:fs')
const assert = require('node:assert/strict')
const { chromium } = require('/home/ikhail_horokhorin/projects/o-hack/frontend/node_modules/playwright')
const root='/tmp/o-hack-sochi'
const base=process.env.BASE_URL || 'http://127.0.0.1:18085'
const directory=`${root}/work/map-polish/evidence/${process.env.SMOKE ? 'stand' : 'places'}`
fs.mkdirSync(directory,{recursive:true})
;(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'/home/ikhail_horokhorin/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']})
 const checks=[]
 try {
 for(const width of [1440,375]) for(const locale of (process.env.SMOKE ? ['ru'] : ['ru','en'])) for(const theme of (process.env.SMOKE ? ['dark'] : ['light','dark'])) {
  const copy=require(`${root}/frontend/src/shared/i18n/locales/${locale}/explore.json`)
  const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'})
  await context.addInitScript(({locale,theme})=>{
   localStorage.setItem('app-locale',locale);localStorage.setItem('app-theme',theme)
   localStorage.setItem('hotel-agent-conversation','76c2fc9d-b636-4155-83f7-6d4b479eb8d1')
  },{locale,theme})
  const page=await context.newPage()
  page.setDefaultTimeout(45000)
  const errors=[];let paid=0
  page.on('pageerror',error=>errors.push(error.message))
  page.on('request',request=>{if(request.url().endsWith('/chat/messages')&&request.method()==='POST')paid++})
  await page.goto(base)
  const sections=page.getByRole('group',{name:copy.panel.tabs})
  if(width===375)await sections.getByRole('radio',{name:copy.panel.hotels,exact:true}).check()
  await page.getByRole('button',{name:'Abris',exact:true}).first().click()
  const hotel=page.getByRole('article',{name:'Abris',exact:true})
  await hotel.getByRole('button',{name:copy.details.showOnMap,exact:true}).nth(1).click()
  const map=page.getByRole('region',{name:copy.map.title,exact:true})
  const routes=map.locator('button[data-kind="route"]')
  await routes.first().waitFor()
  assert.equal(await routes.count(),2)
  const routeAria=await routes.first().getAttribute('aria-label')
  await routes.first().press('Enter')
  const card=page.getByRole('region',{name:copy.place.title,exact:true})
  await card.getByRole('link',{name:copy.place.openOsm,exact:true}).waitFor()
  await card.getByText(copy.place.noHours,{exact:true}).waitFor()
  const osm=await card.getByRole('link',{name:copy.place.openOsm,exact:true}).getAttribute('href')
  assert.match(osm,/openstreetmap.org\/(way|node)\//)
  assert.match(await card.textContent(),/ODbL/)
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
  await page.screenshot({path:`${directory}/${width}-${locale}-${theme}.png`,animations:'disabled'})
  await card.getByRole('button',{name:copy.place.showRoute,exact:true}).click()
  await routes.first().waitFor()
  assert.equal(await routes.count(),1)
  if(width===375)await sections.getByRole('radio',{name:copy.panel.hotels,exact:true}).check()
  await card.getByRole('button',{name:copy.place.back,exact:true}).click()
  await hotel.waitFor()
  assert.equal(paid,0);assert.deepEqual(errors,[])
  const check={width,locale,theme,routeCount:2,routeAria,osm,sourceVisible:true,missingHours:true,showRoute:true,back:true,errors,paidCalls:paid}
  checks.push(check);fs.writeFileSync(`${directory}/browser-checks.json`,JSON.stringify(checks,null,2));console.log(JSON.stringify(check))
  await context.close()
 }
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1})
