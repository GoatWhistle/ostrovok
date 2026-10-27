const fs = require('node:fs')
const { chromium } = require('/home/ikhail_horokhorin/projects/o-hack-sochi/frontend/node_modules/playwright')
const dir = '/tmp/evolution-zoom-extension'
fs.mkdirSync(dir, { recursive: true })
fs.writeFileSync(`${dir}/manifest.json`, JSON.stringify({manifest_version:3,name:'Local zoom verification',version:'1.0',permissions:['tabs'],background:{service_worker:'worker.js'}}))
fs.writeFileSync(`${dir}/worker.js`, 'chrome.runtime.onInstalled.addListener(() => {})')
;(async () => {
  const context = await chromium.launchPersistentContext('', { channel:'chromium',headless:true,viewport:null,args:[`--disable-extensions-except=${dir}`,`--load-extension=${dir}`,'--window-size=1440,1100'] })
  try {
    await context.addInitScript(() => {localStorage.setItem('app-locale','ru');localStorage.setItem('app-theme','dark')})
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker')
    const page = await context.newPage()
    await page.goto('http://127.0.0.1:5179/hotelier/h_demo_typed_check')
    await page.getByRole('button',{name:'Как видят гости',exact:true}).waitFor()
    const zoom = await worker.evaluate(async () => {
      const tab=(await chrome.tabs.query({})).find(t=>t.url?.includes(':5179'))
      await chrome.tabs.setZoom(tab.id,2)
      return chrome.tabs.getZoom(tab.id)
    })
    await page.waitForTimeout(500)
    await page.getByRole('button',{name:'Как видят гости',exact:true}).click()
    await page.locator('dialog input[type=date]').first().waitFor()
    const state = await page.evaluate(() => ({width:innerWidth,dpr:devicePixelRatio,overflow:document.documentElement.scrollWidth>innerWidth, dates:[...document.querySelectorAll('input[type=date]')].map(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}})}))
    await page.screenshot({path:'/tmp/evolution-h05/zoom-200.png'})
    fs.writeFileSync('/tmp/evolution-h05/zoom.json',JSON.stringify({zoom,...state},null,2))
    console.log(JSON.stringify({zoom,...state}))
    if(zoom!==2 || state.overflow) throw Error('Zoom check failed')
  } finally { await context.close() }
})().catch(e=>{console.error(e);process.exitCode=1})
