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
  const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'})
  const errors=[],geo=[]
  page.on('pageerror',e=>errors.push(String(e)))
  page.on('response',async response=>{if(response.url().includes('geo-features:batch'))geo.push({status:response.status(),body:await response.json()})})
  const copy=JSON.parse(readFileSync(`frontend/src/shared/i18n/locales/${locale}/explore.json`))
  await page.addInitScript(({theme,locale,id})=>{
   localStorage.setItem('app-theme',theme)
   localStorage.setItem('app-locale',locale)
   localStorage.setItem('hotel-agent-conversation',id)
  },{theme,locale,id:conversation.id})
  await page.goto('http://127.0.0.1:8080')
  if(width<1024)await page.getByRole('radio',{name:copy.panel.hotels,exact:true}).check()
  await page.getByRole('button',{name:'Астория',exact:true}).first().click()
  const property=page.getByRole('button').filter({hasText:'видом из окна на Исаакиевский собор'}).first()
  await property.waitFor()
  await property.hover()
  await page.waitForResponse(r=>r.url().includes('geo-features:batch'),{timeout:10000}).catch(()=>{})
  await property.click()
  await page.getByRole('article').waitFor().catch(()=>{})
  await page.waitForTimeout(500)
  const detailText=await page.locator('body').innerText()
  assert(detailText.includes('Исаакиевский собор'))
  if(locale==='ru')assert(detailText.includes('Линия обзора свободна'))
  if(width<1024)await page.getByRole('radio',{name:copy.panel.map,exact:true}).check()
  await page.waitForSelector('canvas.maplibregl-canvas')
  await page.waitForTimeout(600)
  const screenshot=`work/window-views/ui-${width}-${theme}-${locale}.png`
  await page.screenshot({path:screenshot})
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)
  assert.equal(overflow,false)
  assert.deepEqual(errors,[])
  assert(geo.some(r=>r.status===200&&r.body.features.some(f=>f.properties.kind==='line')))
  reports.push({width,theme,locale,errors,overflow,geo:geo.map(r=>({status:r.status,features:r.body.features.length})),screenshot})
  console.log('PASS',width,theme,locale)
  await page.close()
 }
}finally{
 writeFileSync('work/window-views/ui-check.json',JSON.stringify(reports,null,2))
 await browser.close()
}
