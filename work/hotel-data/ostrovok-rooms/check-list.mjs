import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {readFileSync,writeFileSync} from 'node:fs'
import {resolve} from 'node:path'
const require=createRequire(resolve('frontend/package.json'))
const {chromium}=require('@playwright/test')
const c=JSON.parse(readFileSync('work/window-views/ui-conversation.json'))
const copy=JSON.parse(readFileSync('frontend/src/shared/i18n/locales/ru/explore.json'))
const browser=await chromium.launch({headless:true})
const results=new Map(), requests=new Set()
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'})
 await page.addInitScript(id=>{localStorage.setItem('app-locale','ru');localStorage.setItem('hotel-agent-conversation',id)},c.id)
 page.on('request',r=>{if(r.url().includes('/offers?')&&r.url().includes('adults=2'))requests.add(r.url())})
 page.on('response',async r=>{if(r.url().includes('/offers?')&&r.url().includes('adults=2')){try{const body=await r.json();results.set(body.hotel_id,{status:r.status(),body})}catch{}}})
 await page.goto('http://localhost:8080')
 await page.getByLabel(copy.offers.checkIn,{exact:true}).fill('2026-11-02')
 await page.getByLabel(copy.offers.checkOut,{exact:true}).fill('2026-11-04')
 await page.getByRole('button',{name:copy.offers.more,exact:true}).click()
 await page.getByRole('button',{name:copy.offers.more,exact:true}).click()
 const expected=new Set(c.search.results.map(r=>r.hotel.id)).size
 for(let i=0;i<180&&results.size<expected;i++)await page.waitForTimeout(1000)
 assert.equal(requests.size,expected)
 assert.equal(results.size,expected)
 console.log('PASS requested and received',results.size,'hotels')
}finally{writeFileSync('work/hotel-data/ostrovok-rooms/list-results.json',JSON.stringify({requests:[...requests],results:[...results.values()]},null,2));await browser.close()}
