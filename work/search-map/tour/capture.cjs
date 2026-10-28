const {chromium}=require('/home/ikhail_horokhorin/projects/o-hack/frontend/node_modules/playwright')
const fs=require('node:fs')
const out='/home/ikhail_horokhorin/projects/o-hack-sochi/work/search-map/tour'
fs.mkdirSync(out,{recursive:true})
const stream=fs.readFileSync('/tmp/search-tour-routes2.sse','utf8').split('\nELAPSED:')[0]
;(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.HOME+'/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']})
 const width=Number(process.env.WIDTH||1440)
 const context=await browser.newContext({viewport:{width,height:900},locale:'ru-RU',reducedMotion:process.env.REDUCED?'reduce':'no-preference'})
 await context.addInitScript(()=>{
  localStorage.setItem('app-locale','ru');localStorage.setItem('factmap-map-appearance','toy-town');localStorage.setItem('app-theme','light')
  const original=window.fetch.bind(window)
  window.fetch=async(...args)=>{
   const response=await original(...args)
   if(!String(args[0]).includes('/chat/messages/stream'))return response
   const frames=(await response.text()).split('\n\n').filter(Boolean)
   return new Response(new ReadableStream({async start(controller){
    for(const frame of frames){
     controller.enqueue(new TextEncoder().encode(frame+'\n\n'))
     const data=JSON.parse(frame.split('data: ')[1]);const stage=data.stage
     await new Promise(resolve=>setTimeout(resolve,stage==='preview'?7000:stage==='research'?3000:150))
    }
    controller.close()
   }}),{status:response.status,headers:response.headers})
  }
 })
 const page=await context.newPage();page.setDefaultTimeout(120000)
 await page.route('**/api/v1/chat/messages/stream',route=>route.fulfill({status:200,contentType:'text/event-stream',body:stream}))
 const errors=[];page.on('pageerror',e=>errors.push(e.message))
 await page.goto('http://127.0.0.1:5182/?tab=chat',{waitUntil:'domcontentloaded'})
 await page.locator('textarea').first().fill('Отель в Сочи рядом с баром')
 await page.locator('textarea').first().press('Enter',{noWaitAfter:true})
 await page.getByText(/мин пешком/).first().waitFor()
 await page.waitForTimeout(3500)
 await page.screenshot({path:`${out}/route-${width}.png`,timeout:120000})
 console.log('route',width,await page.locator('[data-search-status]').innerText())
 await page.locator('[data-search-status="done"]').waitFor()
 await page.waitForTimeout(3000)
 await page.screenshot({path:`${out}/winner-${width}.png`,timeout:120000})
 console.log('winner',width,await page.locator('[data-search-status]').innerText(),'errors',errors)
 fs.writeFileSync(`${out}/browser-${width}.json`,JSON.stringify({width,errors,winner:await page.locator('[data-search-status]').getAttribute('data-search-hotel')},null,2))
 await browser.close()
})().catch(e=>{console.error(e);process.exit(1)})
