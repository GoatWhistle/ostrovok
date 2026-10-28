import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {readFileSync,writeFileSync} from 'node:fs'
import {resolve} from 'node:path'
const require=createRequire(resolve('frontend/package.json'))
const {chromium}=require('@playwright/test')
const conversation=JSON.parse(readFileSync('work/window-views/ui-conversation.json'))
const browser=await chromium.launch({headless:true})
const mobileOnly=process.argv.includes('--mobile')
const reports=mobileOnly?JSON.parse(readFileSync('work/hotel-data/ostrovok/ui-results.json')):[]
try{
 for(const width of (mobileOnly?[375]:[1440,375]))for(const theme of ['light','dark'])for(const locale of ['ru','en']){
  const copy=JSON.parse(readFileSync(`frontend/src/shared/i18n/locales/${locale}/explore.json`))
  const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'})
  const errors=[]
  page.on('pageerror',e=>errors.push(String(e)))
  await page.addInitScript(({theme,locale,id})=>{
   localStorage.setItem('app-theme',theme)
   localStorage.setItem('app-locale',locale)
   localStorage.setItem('hotel-agent-conversation',id)
  },{theme,locale,id:conversation.id})
  await page.goto('http://127.0.0.1:8080')
  if(width<1024)await page.getByRole('radio',{name:copy.panel.hotels,exact:true}).check()
  await page.getByRole('button',{name:'Астория',exact:true}).first().click()
  const offers=page.getByText(copy.offers.title,{exact:true}).locator('..')
  await offers.getByRole('button',{name:copy.offers.more,exact:true}).click()
  await offers.getByRole('button',{name:copy.offers.more,exact:true}).click()
  await offers.getByLabel(copy.offers.checkIn,{exact:true}).fill('2026-11-02')
  const responseTask=page.waitForResponse(r=>r.url().includes('/hotels/r3107676/offers')&&r.url().includes('adults=2')&&r.url().includes('check_out=2026-11-04'),{timeout:55000})
  await offers.getByLabel(copy.offers.checkOut,{exact:true}).fill('2026-11-04')
  const response=await responseTask
  const body=await response.json()
  assert.equal(response.status(),200)
  assert.equal(body.status,'available',JSON.stringify(body))
  assert.equal(body.source,'Островок')
  assert.equal(body.sandbox,false)
  await offers.getByText(body.offers[0].room_name,{exact:true}).waitFor()
  if(body.offers[0].meal==='nomeal')await offers.getByText(copy.offers.meal.replace('{{value}}',copy.offers.noMeal),{exact:true}).waitFor()
  await offers.getByText(copy.offers.stayTotal,{exact:true}).waitFor()
  await offers.scrollIntoViewIfNeeded()
  await page.waitForTimeout(300)
  const screenshot=`work/hotel-data/ostrovok/offers-${width}-${theme}-${locale}.png`
  await page.screenshot({path:screenshot})
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)
  reports.push({width,theme,locale,errors,overflow,status:body.status,offers:body.offers.length,screenshot})
  assert.equal(overflow,false)
  assert.deepEqual(errors,[])
  console.log('PASS',width,theme,locale)
  await page.close()
 }
}finally{
 writeFileSync('work/hotel-data/ostrovok/ui-results.json',JSON.stringify(reports,null,2))
 await browser.close()
}
