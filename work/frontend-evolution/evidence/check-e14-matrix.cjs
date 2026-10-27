const fs=require('node:fs')
const {chromium}=require('/home/ikhail_horokhorin/projects/o-hack-sochi/frontend/node_modules/playwright')
const AxeBuilder=require('/home/ikhail_horokhorin/projects/o-hack-sochi/frontend/node_modules/@axe-core/playwright').default
const root='/home/ikhail_horokhorin/projects/o-hack-sochi'
const chat=require(`${root}/work/frontend-evolution/evidence/e12-conversation.json`).id
const out=process.env.EVOLUTION_OUT??'/tmp/evolution-e14';fs.mkdirSync(out,{recursive:true})
const rows=[]
const widths=process.env.WIDTHS?process.env.WIDTHS.split(',').map(Number):(process.env.EXTRA_WIDTHS?[768,1024,1920,2560]:[375,1440])
;(async()=>{
const browser=await chromium.launch({headless:true,args:['--disable-webgl']})
try{for(const width of widths)for(const locale of (process.env.EXTRA_WIDTHS?['ru']:['ru','en']))for(const theme of (process.env.EXTRA_WIDTHS?['dark']:['light','dark']))for(const style of (process.env.EXTRA_WIDTHS?['toy-town']:['neon','toy-town'])){
const context=await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce'})
await context.addInitScript(({locale,theme})=>{localStorage.setItem('app-locale',locale);localStorage.setItem('app-theme',theme)},{locale,theme})
const page=await context.newPage();page.setDefaultTimeout(20000)
const t=require(`${root}/frontend/src/shared/i18n/locales/${locale}/explore.json`)
const prefix=`${width}-${locale}-${theme}-${style}`
const routes={list:`/?chat=${chat}&tab=hotels&style=${style}`,panel:`/?chat=${chat}&hotel=n11331531334&tab=hotels&style=${style}`,page:`/hotels/n11331531334?chat=${chat}&tab=hotels&style=${style}`,map:`/?chat=${chat}&hotel=n11331531334&map=full&tab=map&style=${style}`,hotelier:'/hotelier/h_demo_typed_check'}
for(const [name,path] of Object.entries(routes)){
 const row={width,locale,theme,style,name,errors:[]};rows.push(row)
 const error=e=>row.errors.push(e.message);page.on('pageerror',error)
 await page.goto('http://127.0.0.1:5179'+path,{waitUntil:'domcontentloaded'})
 if(name==='hotelier')await page.getByRole('textbox',{name:t.answerFields.note,exact:true}).waitFor()
 else if(name==='map')await page.getByRole('button',{name:t.surfaces.openHotelPage,exact:true}).waitFor()
 else if(name==='page')await page.getByRole('region',{name:t.surfaces.hotelPage,exact:true}).getByText('Cosmos Adler Hotel',{exact:true}).first().waitFor()
 else if(name==='panel')await page.getByRole('button',{name:t.surfaces.openHotelPage,exact:true}).waitFor()
 else await page.getByRole('button',{name:'Abris',exact:true}).waitFor()
 if(process.env.TEXT_SCALE)await page.evaluate(scale=>document.documentElement.style.fontSize=scale+'%',process.env.TEXT_SCALE)
 await page.waitForTimeout(200)
 row.geometry=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,wide:[...document.querySelectorAll('button,input,textarea,h1,h2')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.right>innerWidth+1}).slice(0,8).map(e=>({tag:e.tagName,text:e.textContent?.slice(0,70),width:e.getBoundingClientRect().width})),surface:document.querySelector('[data-surface]')?.getAttribute('data-surface')}))
 if(style==='neon'||process.env.EXTRA_WIDTHS){const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();row.violations=result.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}))}
 await page.screenshot({path:`${out}/${prefix}-${name}.png`})
 console.log(JSON.stringify({width,locale,theme,style,name,overflow:row.geometry.overflow,violations:row.violations?.map(v=>v.id)}))
 page.off('pageerror',error)
 fs.writeFileSync(`${out}/results.json`,JSON.stringify(rows,null,2))
}
await context.close()
}}finally{fs.writeFileSync(`${out}/results.json`,JSON.stringify(rows,null,2));await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1})
