const fs = require('node:fs')
const assert = require('node:assert/strict')
const { chromium } = require('/home/ikhail_horokhorin/projects/o-hack/frontend/node_modules/playwright')
const root = '/tmp/o-hack-sochi'
const directory = `${root}/work/map-polish/evidence/comparison`
fs.mkdirSync(directory, {recursive:true})
const hotelIds = ['n4712092442','n10058780093','n10574267409','n10759606596','n11138786401']
;(async()=>{
 const browser = await chromium.launch({headless:true, executablePath:'/home/ikhail_horokhorin/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome',args:['--no-sandbox']})
 const checks=[]
 try {
 for(const width of [1440,375]) for(const locale of ['ru']) for(const theme of ['light']) for(const count of [2]) {
  const copy=require(`${root}/frontend/src/shared/i18n/locales/${locale}/explore.json`)
  const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'})
  await context.addInitScript(({locale,theme})=>{localStorage.setItem('app-locale',locale);localStorage.setItem('app-theme',theme)}, {locale,theme})
  const page=await context.newPage()
  const errors=[]
  let paid=0
  page.on('pageerror',error=>errors.push(error.message))
  page.on('request',request=>{if(/\/chat\/messages$|\/offers\?/.test(request.url()))paid++})
  await page.goto(`http://127.0.0.1:18085/compare?${hotelIds.slice(0,count).map(id=>`hotel=${id}`).join('&')}`)
  await page.getByRole('article',{name:'Abris',exact:true}).waitFor()
  await page.locator('[data-characteristic]').first().waitFor()
  await page.route('**/api/v1/compare', route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({code:'unavailable',message:'Test outage'})}))
  await page.reload()
  await page.getByRole('article',{name:'Abris',exact:true}).waitFor()
  await page.getByText(copy.compare.error,{exact:true}).waitFor()
  assert.equal(await page.getByRole('article').count(),count)
  await page.unroute('**/api/v1/compare')
  const longName='Санаторно-курортный комплекс «Морская панорама» с оздоровительным центром и семейными апартаментами на Черноморском побережье'
  await page.route('**/api/v1/hotels/n4712092442',async route=>{
    const response=await route.fetch()
    const payload=await response.json()
    payload.hotel.name=longName
    payload.hotel.address='Краснодарский край, городской округ Сочи, Адлерский район, улица Старообрядческая, дом 109, корпус 4'
    payload.hotel.thumbnail_url=null
    await route.fulfill({response,json:payload})
  })
  await page.reload()
  await page.getByRole('article',{name:longName,exact:true}).waitFor()
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)
  assert.equal(overflow,false)
  await page.screenshot({path:`${directory}/edges-${width}.png`,animations:'disabled'})
  assert.deepEqual(errors,[])
  assert.equal(paid,0)
  console.log(JSON.stringify({width,longName:true,matrixErrorPreservesHeaders:true,overflow,errors,paid}))
  await context.close()
 }
 } finally { await browser.close() }
})().catch(error=>{console.error(error);process.exitCode=1})
