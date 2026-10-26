import { boot } from '../boot.js'
import * as maplibre from '../vendor/maplibre-gl.mjs'

const app=await boot('sunset'),{map}=app
const tileUrl=new URL('../data/terrain/{z}/{x}/{y}.png',import.meta.url).href.replaceAll('%7B','{').replaceAll('%7D','}')
const dem=new mlcontour.DemSource({url:tileUrl,encoding:'mapbox',maxzoom:13,worker:true,cacheSize:100})
dem.setupMaplibre(maplibre)
map.addSource('elevation',{type:'raster-dem',tiles:[dem.sharedDemProtocolUrl],tileSize:256,maxzoom:13,minzoom:13,encoding:'mapbox',bounds:[39.67,43.40,39.96,43.61]})
map.addSource('contours',{type:'vector',tiles:[dem.contourProtocolUrl({thresholds:{13:[20,100],15:[10,50]},contourLayer:'contours',elevationKey:'ele',levelKey:'level'})],minzoom:13,maxzoom:15,bounds:app.data.meta.bbox})
map.addLayer({id:'elevation-bands',type:'color-relief',source:'elevation',paint:{'color-relief-color':['step',['elevation'],'#e4c89e',20,'#d7b089',50,'#bd987f',100,'#aa7e74',200,'#91666d',400,'#745662',800,'#5c4959',1600,'#44394d'],'color-relief-opacity':['interpolate',['linear'],['zoom'],13,.8,15,.35,17,0]}},'local-water')
map.addLayer({id:'terrain-shade',type:'hillshade',source:'elevation',paint:{'hillshade-shadow-color':'#634451','hillshade-highlight-color':'#ffe4b4','hillshade-exaggeration':['interpolate',['linear'],['zoom'],13,.45,16,0]}},'local-water')
map.addLayer({id:'contour-lines',type:'line',source:'contours','source-layer':'contours',filter:['>', ['get','ele'],2],paint:{'line-color':'#915b61','line-width':['case',['>', ['get','level'],0],1.2,.6],'line-opacity':.5}},'building-bases')
map.setTerrain({source:'elevation',exaggeration:1})
const reflection=new Uint8Array(128*32*4)
for(let y=0;y<32;y++)for(let x=0;x<128;x++){const band=y%9<2,alpha=band?Math.round(65*(.5+.5*Math.sin(x*.07))):0;reflection.set([255,222,161,alpha],(y*128+x)*4)}
map.addImage('sun-reflection',{width:128,height:32,data:reflection})
map.addLayer({id:'sea-reflection',type:'fill',source:'water',filter:['==',['get','kind'],'sea'],paint:{'fill-pattern':'sun-reflection','fill-opacity':.7}},'local-beach')
app.onTime=()=>{
 const night=app.sun.altitude<0,dusk=app.sun.altitude<15
 map.setSky({'sky-color':night?'#302a48':dusk?'#af6d78':'#e9cbaa','horizon-color':night?'#755167':'#ffca8b','fog-color':'#db9e86','sky-horizon-blend':.65,'horizon-fog-blend':0,'fog-ground-blend':0})
 map.setPaintProperty('local-water','fill-color',night?'#524355':'#b97b73')
 map.setPaintProperty('terrain-shade','hillshade-illumination-direction',app.sun.azimuth)
 map.setPaintProperty('sea-reflection','fill-opacity',night?.1:dusk?.8:.35)
}
app.onToggle=(key,value)=>{if(key==='effects'){for(const id of ['terrain-shade','sea-reflection','contour-lines'])map.setLayoutProperty(id,'visibility',value?'visible':'none');map.setTerrain(value?{source:'elevation',exaggeration:1}:null)}}
app.onTime()
