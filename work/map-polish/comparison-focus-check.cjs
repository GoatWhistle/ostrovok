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
 for(const width of [375]) for(const locale of ['ru']) for(const theme of ['light']) for(const count of [5]) {
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
  const toggle=page.getByRole('button',{name:copy.compare.onlyDifferences,exact:true})
  if(await toggle.getAttribute('aria-pressed')==='true') await toggle.click()
  const full=await page.locator('[data-characteristic]').count()
  const differing=await page.locator('[data-characteristic][data-different="true"]').count()
  assert.ok(differing < full)
  await toggle.click()
  assert.equal(await page.locator('[data-characteristic]').count(),differing)
  await toggle.click()
  assert.equal(await page.locator('[data-characteristic]').count(),full)
  const alignment=await page.locator('[data-characteristic]').evaluateAll(elements=>{
   const groups={}
   for(const el of elements)(groups[el.dataset.characteristic]??=[]).push(el.getBoundingClientRect().y)
   return Object.entries(groups).filter(([,ys])=>Math.max(...ys)-Math.min(...ys)>1)
  })
  assert.deepEqual(alignment,[])
  await page.screenshot({path:`${directory}/before-dialog.png`,fullPage:false,animations:"disabled"})
  const rows=page.getByRole('article',{name:'Abris',exact:true}).locator('[data-characteristic]')
  await rows.first().getByRole('button').click()
  await page.getByRole('dialog').waitFor()
  await page.keyboard.press('Escape')
  await page.getByRole('dialog').waitFor({state:'detached'})
  console.log(JSON.stringify(await page.evaluate(()=>[...document.querySelectorAll('*')].filter(el=>el.scrollTop>0 || (el.tagName==='SPAN'&&el.textContent==='Abris')).map(el=>({tag:el.tagName,class:el.className,scrollTop:el.scrollTop,rect:el.getBoundingClientRect().toJSON(),style:{visibility:getComputedStyle(el).visibility,opacity:getComputedStyle(el).opacity,color:getComputedStyle(el).color},content:el.textContent.slice(0,70)})))))
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)
  assert.equal(overflow,false)
  assert.equal(paid,0)
  assert.deepEqual(errors,[])
  await page.evaluate(() => window.scrollTo(0,0))
  await page.screenshot({path:`${directory}/${width}-${locale}-${theme}-${count}.png`,fullPage:false,animations:"disabled"})
  const check={width,locale,theme,count,fullCells:full,differingCells:differing,aligned:true,dialogEscape:true,overflow,errors,paidCalls:paid}
  checks.push(check)
  fs.writeFileSync(`${directory}/browser-checks.json`,JSON.stringify(checks,null,2))
  console.log(JSON.stringify(check))
  await context.close()
 }
 } finally { await browser.close() }
})().catch(error=>{console.error(error);process.exitCode=1})
