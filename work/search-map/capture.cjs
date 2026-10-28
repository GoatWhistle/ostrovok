const { chromium } = require('/home/ikhail_horokhorin/projects/o-hack/frontend/node_modules/playwright')
const fs = require('node:fs')
const out='/home/ikhail_horokhorin/projects/o-hack-sochi/work/search-map'
fs.mkdirSync(out,{recursive:true})
;(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.HOME+'/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']})
 for(const width of [1440,375]){
 const context=await browser.newContext({viewport:{width,height:900},locale:'ru-RU',reducedMotion:'reduce'})
 await context.addInitScript(()=>{
 localStorage.setItem('app-locale','ru');localStorage.setItem('factmap-map-appearance','neon');localStorage.setItem('app-theme','dark')
 const original=window.fetch.bind(window)
 window.fetch=async(...args)=>{
  const response=await original(...args)
  if(!String(args[0]).includes('/chat/messages/stream')) return response
  const frames=(await response.text()).split('\n\n').filter(Boolean)
  return new Response(new ReadableStream({async start(controller){
   for(const frame of frames){
    controller.enqueue(new TextEncoder().encode(frame+'\n\n'))
    await new Promise(resolve=>setTimeout(resolve,frame.includes('"stage": "research"')?12000:500))
   }
   controller.close()
  }}),{status:response.status,headers:response.headers})
 }
 })
 const page=await context.newPage();page.setDefaultTimeout(120000)
 const errors=[];page.on('pageerror',e=>errors.push(e.message))
 await page.goto('http://127.0.0.1:5181/?tab=chat',{waitUntil:'domcontentloaded'})
 await page.locator('textarea').first().fill('Отель в Сочи')
 await page.locator('textarea').first().press('Enter',{noWaitAfter:true})
 await page.locator('[data-search-status="checking"]').waitFor()
 await page.waitForTimeout(2000)
 await page.screenshot({path:`${out}/search-${width}.png`,timeout:120000})
 console.log(width,'checking', await page.locator('[data-search-status]').innerText(),errors)
 await page.waitForFunction(()=>!document.querySelector('[data-search-status="checking"]'),{timeout:120000})
 await page.screenshot({path:`${out}/result-${width}.png`,timeout:120000})
 console.log(width,'stored',await page.evaluate(()=>localStorage.getItem('factmap-map-appearance')))
 await context.close()
 }
 await browser.close()
})().catch(e=>{console.error(e);process.exit(1)})
