import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {readFileSync,writeFileSync} from 'node:fs'
import {resolve} from 'node:path'
const require=createRequire(resolve('frontend/package.json'))
const {chromium}=require('@playwright/test')
const browser=await chromium.launch({headless:true})
const reports=[]
try {
 for(const width of [375,1440]) for(const theme of ['light','dark']) for(const locale of ['ru','en']) {
  const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'})
  const errors=[]
  page.on('pageerror',error=>errors.push(String(error)))
  await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort())
  await page.goto(`http://127.0.0.1:5198/free-sources-preview.html?locale=${locale}`)
  await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme)
  const copy=JSON.parse(readFileSync(`frontend/src/shared/i18n/locales/${locale}/explore.json`))
  await page.getByRole('button',{name:copy.map.attributionTitle}).click()
  const list=page.getByRole('list')
  await list.waitFor()
  const box=await list.boundingBox()
  assert(box&&box.x>=0&&box.y>=0&&box.x+box.width<=width)
  assert.equal(await list.getByRole('link').count(),7)
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
  assert.deepEqual(errors,[])
  await page.screenshot({path:`work/hotel-data/credits-${width}-${theme}-${locale}.png`})
  reports.push({width,theme,locale,box,errors})
  await page.close()
 }
 writeFileSync('work/hotel-data/source-credits-check.json',JSON.stringify(reports,null,2))
 console.log(JSON.stringify({cases:reports.length,passed:true}))
} finally { await browser.close() }
