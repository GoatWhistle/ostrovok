import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {readFileSync,writeFileSync} from 'node:fs'
import {resolve} from 'node:path'
const require=createRequire(resolve('frontend/package.json'))
const {chromium}=require('@playwright/test')
const conversation=JSON.parse(readFileSync('work/window-views/ui-conversation.json'))
const browser=await chromium.launch({headless:true})
const reports=[]
try{
for(const width of [1440,375])for(const theme of ['light','dark'])for(const locale of ['ru','en']){
 const copy=JSON.parse(readFileSync(`frontend/src/shared/i18n/locales/${locale}/explore.json`))
 const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'})
 const errors=[];page.on('pageerror',e=>errors.push(String(e)))
 await page.addInitScript(({theme,locale,id})=>{localStorage.setItem('app-theme',theme);localStorage.setItem('app-locale',locale);localStorage.setItem('hotel-agent-conversation',id)},{theme,locale,id:conversation.id})
 await page.goto('http://127.0.0.1:8080')
 if(width<1024)await page.getByRole('radio',{name:copy.panel.hotels,exact:true}).check()
 await page.getByRole('button',{name:'Астория',exact:true}).first().click()
 const section=page.getByText(copy.offers.title,{exact:true}).locator('..')
 await section.getByLabel(copy.offers.checkIn,{exact:true}).fill('2026-11-02')
 await section.getByLabel(copy.offers.checkOut,{exact:true}).fill('2026-11-04')
 await section.getByRole('button',{name:copy.offers.more,exact:true}).click()
 const done=page.waitForResponse(r=>r.url().includes('/hotels/r3107676/offers')&&r.url().includes('adults=2')&&r.url().includes('check_out=2026-11-04'),{timeout:95000})
 await section.getByRole('button',{name:copy.offers.more,exact:true}).click()
 const response=await done;const body=await response.json()
 assert.equal(response.status(),200);assert.equal(body.status,'available');assert.equal(body.rates_complete,true);assert.ok(body.offers.length>1);assert.ok(body.room_groups.length>1)
 writeFileSync('work/hotel-data/ostrovok-rooms/astoria-live.json',JSON.stringify(body,null,2))
 const groupIndex=body.room_groups.findIndex(g=>g.photos.length>1&&body.offers.some(o=>o.room_group_id===g.id))
 assert.ok(groupIndex>=0)
 const room=body.room_groups[groupIndex]
 const open=section.getByRole('button',{name:copy.rooms.open,exact:true}).nth(groupIndex)
 await open.scrollIntoViewIfNeeded()
 await page.screenshot({path:`work/hotel-data/ostrovok-rooms/catalog-${width}-${theme}-${locale}.png`})
 await open.click()
 const gallery=page.getByRole('region',{name:copy.rooms.photos,exact:true})
 await gallery.locator('img').evaluate(async img=>{await img.decode()})
 assert.equal(await gallery.locator('img').getAttribute('src'),room.photos[0])
 await gallery.getByRole('button',{name:copy.rooms.nextPhoto,exact:true}).click()
 await gallery.locator('img').evaluate(async img=>{await img.decode()})
 assert.equal(await gallery.locator('img').getAttribute('src'),room.photos[1])
 await gallery.scrollIntoViewIfNeeded()
 await page.screenshot({path:`work/hotel-data/ostrovok-rooms/room-${width}-${theme}-${locale}.png`})
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)
 assert.equal(overflow,false);assert.deepEqual(errors,[])
 await section.getByRole('button',{name:copy.rooms.back,exact:true}).click()
 assert.equal(await section.getByLabel(copy.offers.checkIn,{exact:true}).inputValue(),'2026-11-02')
 assert.equal(await section.getByRole('button',{name:copy.rooms.open,exact:true}).count(),body.room_groups.length)
 reports.push({width,theme,locale,errors,overflow,offers:body.offers.length,rooms:body.room_groups.length,room_id:room.id,photos:room.photos.length})
 console.log('PASS',width,theme,locale)
 await page.close()
}
}finally{writeFileSync('work/hotel-data/ostrovok-rooms/ui-results.json',JSON.stringify(reports,null,2));await browser.close()}
