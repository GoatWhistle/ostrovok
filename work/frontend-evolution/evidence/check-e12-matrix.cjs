const {chromium}=require('/home/ikhail_horokhorin/projects/o-hack-sochi/frontend/node_modules/playwright');const fs=require('node:fs');
const real=JSON.parse(fs.readFileSync(__dirname + '/e12-live-offers.json'));const base='http://127.0.0.1:5179';const out='/home/ikhail_horokhorin/projects/o-hack-sochi/work/frontend-evolution/evidence';
(async()=>{const browser=await chromium.launch({headless:true,args:['--disable-webgl']});const results=[];
for(const width of [375,1440])for(const theme of ['light','dark'])for(const lang of ['ru','en']){
const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'});page.setDefaultTimeout(30000);const errors=[];let offers=0;page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(({theme,lang})=>{localStorage.setItem('app-theme',theme);localStorage.setItem('app-locale',lang)},{theme,lang});
await page.route('**/api/v1/hotels/*/offers?*',async route=>{offers++;const u=new URL(route.request().url());await route.fulfill({json:{...real,check_in:u.searchParams.get('check_in'),check_out:u.searchParams.get('check_out'),adults:Number(u.searchParams.get('adults'))}})});
await page.goto(base+'/?chat=e665bb3e-121a-479a-b511-34a696f3dd85&hotel=n11331531334&tab=hotels',{waitUntil:'domcontentloaded'});const dates=page.locator('input[type=date]:visible');await dates.first().fill('2026-11-10');await dates.last().fill('2026-11-12');const plus=page.getByRole('button',{name:lang==='ru'?'Больше':'More',exact:true});await plus.click();await plus.click();const open=page.getByRole('button',{name:lang==='ru'?'Подробнее о номере':'Room details',exact:true});
await page.waitForFunction(()=>document.body.innerText.includes('14'));
const roomButtons=page.locator('button').filter({hasText:lang==='ru'?'Выбрать номер':'Room details'});
const body=await page.locator('body').innerText();
await page.screenshot({path:out+`/shots/e12-${width}-${theme}-${lang}.png`});
results.push({width,theme,lang,overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),errors,offers,body:body.slice(0,6500),buttons:await page.locator('button:visible').allTextContents()});console.log(width,theme,lang,errors.length);await page.close();
}
fs.writeFileSync(out+'/e12-matrix.json',JSON.stringify(results,null,2));await browser.close();if(results.some(r=>r.overflow||r.errors.length))throw new Error('Card matrix failed');})().catch(e=>{console.error(e);process.exit(1)});
