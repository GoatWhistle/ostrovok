import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {readFileSync,writeFileSync} from 'node:fs'
import {resolve} from 'node:path'
const require=createRequire(resolve('frontend/package.json'))
const {chromium}=require('@playwright/test')
const conversation=JSON.parse(readFileSync('work/window-views/ui-conversation.json'))
const browser=await chromium.launch({headless:true})
const reports=[]
try {
for (const width of [1440,375]) for (const theme of ['light','dark']) for (const locale of ['ru','en']) {
 const copy=JSON.parse(readFileSync(`frontend/src/shared/i18n/locales/${locale}/explore.json`))
 const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'})
 const errors=[];page.on('pageerror',e=>errors.push(String(e)))
 await page.addInitScript(({theme,locale,id})=>{localStorage.setItem('app-theme',theme);localStorage.setItem('app-locale',locale);localStorage.setItem('hotel-agent-conversation',id)},{theme,locale,id:conversation.id})
 await page.goto('http://127.0.0.1:8080')
 if(width<1024)await page.getByRole('radio',{name:copy.panel.hotels,exact:true}).check()
 await page.getByLabel(copy.offers.checkIn,{exact:true}).fill('2026-11-02')
 await page.getByLabel(copy.offers.checkOut,{exact:true}).fill('2026-11-04')
 await page.getByRole('button',{name:copy.offers.more,exact:true}).click()
 const done=page.waitForResponse(r=>r.url().includes('/hotels/r3107676/offers')&&r.url().includes('adults=2')&&r.url().includes('check_out=2026-11-04'),{timeout:65000})
 await page.getByRole('button',{name:copy.offers.more,exact:true}).click()
 const response=await done;const body=await response.json()
 assert.equal(response.status(),200);assert.equal(body.status,'available',JSON.stringify(body));assert.ok(body.facilities.length);assert.ok(body.room_categories.length);assert.ok(body.photo_url)
 const result=page.getByRole('article').filter({has:page.getByRole('button',{name:'Астория',exact:true})})
 await result.getByText(copy.offers.available,{exact:true}).waitFor()
 await result.scrollIntoViewIfNeeded()
 await page.screenshot({path:`work/hotel-data/ostrovok-cards/list-${width}-${theme}-${locale}.png`})
 await result.getByRole('button',{name:copy.offers.viewRooms,exact:true}).click()
 const offers=page.getByText(copy.offers.title,{exact:true}).locator('..')
 await offers.getByText(body.offers[0].room_name,{exact:true}).waitFor()
 assert.equal(await offers.getByLabel(copy.offers.checkIn,{exact:true}).inputValue(),'2026-11-02')
 assert.equal(await offers.getByLabel(copy.offers.checkOut,{exact:true}).inputValue(),'2026-11-04')
 await offers.getByText(copy.offers.facilitiesTitle,{exact:true}).waitFor()
 await offers.getByText(copy.offers.categoriesTitle,{exact:true}).waitFor()
 await offers.scrollIntoViewIfNeeded()
 await offers.locator('img').evaluate(async image => { await image.decode() })
 await page.screenshot({path:`work/hotel-data/ostrovok-cards/detail-${width}-${theme}-${locale}.png`})
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)
 assert.equal(overflow,false);assert.deepEqual(errors,[])
 reports.push({width,theme,locale,errors,overflow,status:body.status,price:body.offers[0].price_amount,facilities:body.facilities,categories:body.room_categories.length})
 console.log('PASS',width,theme,locale)
 await page.close()
}
}finally{writeFileSync('work/hotel-data/ostrovok-cards/ui-results.json',JSON.stringify(reports,null,2));await browser.close()}
