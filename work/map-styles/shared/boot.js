import { Map, NavigationControl, addProtocol, setWorkerUrl } from './vendor/maplibre-gl.mjs'
import { palettes } from './palettes.js'
import { baseStyle, paintData } from './style.js'
import { addPins } from './pins.js'
import { startHud } from './hud.js'

setWorkerUrl(new URL('./vendor/maplibre-gl-worker.mjs',import.meta.url).href)
const protocol=new pmtiles.Protocol();addProtocol('pmtiles',protocol.tile)

export async function boot(kind){
 window.addEventListener('unhandledrejection',event=>{const loading=document.querySelector('#loading');loading.hidden=false;loading.replaceChildren(document.createTextNode('Карта не загрузилась. Проверьте поддержку WebGL2 и '));const retry=document.createElement('a');retry.href=location.href;retry.textContent='повторите попытку';loading.append(retry)})
 const params=new URLSearchParams(location.search),scene=params.get('scene')==='sochi'?'sochi':'adler'
 const data=await fetch(new URL(`./data/${scene}.json`,import.meta.url)).then(r=>r.json())
 const palette=palettes[kind],reduced=matchMedia('(prefers-reduced-motion: reduce)').matches
 document.documentElement.dataset.style=kind;document.querySelector('#title').textContent=palette.title
 document.querySelector('#subtitle').textContent=palette.subtitle;document.title=`${palette.name} | Factmap`
 document.querySelector('#scene').value=scene
 document.querySelector('#selection').textContent=data.meta.hotel.name
 const map=new Map({container:'map',style:baseStyle(palette,scene),center:data.meta.center,zoom:15.5,pitch:kind==='iso'?55:52,bearing:kind==='iso'?45:-24,
  maxBounds:[[data.meta.center[0]-.035,data.meta.center[1]-.025],[data.meta.center[0]+.035,data.meta.center[1]+.025]],
  minZoom:13,maxZoom:19,pixelRatio:Math.min(devicePixelRatio,2),canvasContextAttributes:{antialias:true},attributionControl:{compact:true,customAttribution:'© OpenStreetMap contributors / Protomaps / Copernicus GLO-30'}})
 map.addControl(new NavigationControl({visualizePitch:true}),'bottom-right')
 const app={map,data,palette,kind,reduced,state:{labels:true,routes:true,props:true,effects:true,hour:kind==='neon'?21:16},quality:'полное качество',started:performance.now()}
 window.mapPrototype=app
 map.on('error',event=>{console.error(event.error);document.querySelector('#notice').textContent=event.error.message})
 await new Promise(resolve=>map.once('load',resolve));paintData(app);addPins(app);startHud(app)
 app.firstFrameMs=performance.now();document.querySelector('#loading').hidden=true
 document.querySelector('#scene').onchange=event=>{params.set('scene',event.target.value);location.search=params}
 for(const button of document.querySelectorAll('[data-camera]'))button.onclick=()=>camera(app,button.dataset.camera)
 for(const key of ['labels','routes','props','effects'])document.querySelector(`#${key}`).onchange=event=>toggle(app,key,event.target.checked)
 const hour=document.querySelector('#hour');hour.value=app.state.hour
 hour.oninput=()=>{app.state.hour=+hour.value;document.querySelector('#clock').textContent=`${hour.value}:00`;light(app);app.onTime?.(app.state.hour)}
 document.querySelector('#clock').textContent=`${hour.value}:00`
 light(app)
 return app
}

function camera(app,preset){
 const options={overview:{zoom:14,pitch:25,bearing:app.kind==='iso'?45:-24},street:{zoom:17,pitch:60,bearing:app.kind==='iso'?45:-24},balcony:{zoom:18.2,pitch:72,bearing:225}}[preset]
 app.map.easeTo({...options,center:app.data.meta.center,duration:app.reduced?0:700})
 document.querySelectorAll('[data-camera]').forEach(button=>button.ariaPressed=String(button.dataset.camera===preset))
}
function toggle(app,key,value){
 app.state[key]=value
 if(key==='labels')for(const layer of app.map.getStyle().layers)if(layer.type==='symbol')app.map.setLayoutProperty(layer.id,'visibility',value?'visible':'none')
 if(key==='routes')for(const id of ['route-line','route-shadow','route-straight'])app.map.setLayoutProperty(id,'visibility',value?'visible':'none')
 if(key==='props')app.map.setLayoutProperty('mapped-trees','visibility',value?'visible':'none')
 app.onToggle?.(key,value)
}
function light(app){
 const when=new Date(`2026-10-26T${String(app.state.hour).padStart(2,'0')}:00:00+03:00`)
 const position=SunCalc.getPosition(when,app.data.meta.center[1],app.data.meta.center[0])
 const altitude=position.altitude*180/Math.PI
 app.sun={azimuth:(position.azimuth*180/Math.PI+180)%360,altitude}
 app.map.setLight({anchor:'map',color:altitude<12?'#ffd2a0':'#fff8e9',intensity:altitude<0?.25:.65,position:[1.5,app.sun.azimuth,Math.max(0,Math.min(180,90-altitude))]})
}
