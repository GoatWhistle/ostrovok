import { boot } from '../boot.js'
import { polygons } from '../rendering/coordinates.js'
import { classColor } from '../palettes.js'

const app=await boot('iso'),{map,data,palette}=app
const color=hex=>hex.slice(1).match(/../g).map(value=>parseInt(value,16))
const buildings=data.buildings.features.flatMap(feature=>polygons(feature.geometry).map(polygon=>({polygon,...feature.properties})))
const ground=data.ground.features.flatMap(feature=>polygons(feature.geometry).map(polygon=>({polygon,...feature.properties})))
const ambient=new deck.AmbientLight({color:[255,244,222],intensity:1.5})
let overlay
const redraw=()=>{
 const timestamp=Date.parse(`2026-10-26T${String(app.state.hour).padStart(2,'0')}:00:00+03:00`)
 const sun=new deck._SunLight({timestamp,color:[255,225,181],intensity:2,_shadow:app.state.effects&&map.getZoom()>=15})
 const effect=new deck.LightingEffect({ambient,sun});effect.shadowColor=[.13,.18,.15,.5]
 const trees=app.state.props&&map.getZoom()>=15?data.trees.features:[];app.propsCount=trees.length
 const layers=[
  new deck.SolidPolygonLayer({id:'iso-ground',data:ground,getPolygon:d=>d.polygon,getFillColor:d=>color(['forest','wood','garden','park','grass'].includes(d.class)?palette.park:palette.land),extruded:false,material:{ambient:.7,diffuse:.5,shininess:1},beforeId:'building-lines'}),
  new deck.SolidPolygonLayer({id:'iso-buildings',data:buildings,getPolygon:d=>d.polygon,getElevation:d=>Math.max(2,d.height),getFillColor:d=>color(classColor(d.class,palette)),extruded:true,wireframe:false,material:{ambient:.5,diffuse:.8,shininess:4,specularColor:[25,25,25]},beforeId:'building-lines'}),
  new deck.ScenegraphLayer({id:'iso-trees',data:trees,scenegraph:new URL('../models/pine.glb',import.meta.url).href,getPosition:d=>[...d.geometry.coordinates,0],getOrientation:[0,0,90],getScale:[7,7,7],sizeScale:1,_lighting:'pbr',beforeId:'route-shadow'})
 ]
 if(overlay)overlay.setProps({layers,effects:[effect]})
 else{overlay=new deck.MapLibreOverlay({interleaved:true,layers,effects:[effect]});map.addControl(overlay)}
 app.deckBuildings=buildings.length
}
map.setLayoutProperty('building-volumes','visibility','none');map.setLayoutProperty('mapped-trees','visibility','none')
map.addLayer({id:'road-markings',type:'line',source:'roads',minzoom:17,filter:['in',['get','kind'],['literal',['primary','secondary','tertiary','residential']]],paint:{'line-color':'#f6edcd','line-width':1,'line-dasharray':[3,4]}} ,'building-lines')
const sand=new Uint8Array(32*32*4)
for(let i=0;i<sand.length;i+=4){const dot=((i/4)*73)%97<10;sand.set(dot?[174,151,106,120]:[0,0,0,0],i)}
map.addImage('sand-grain',{width:32,height:32,data:sand})
map.addLayer({id:'sand-grain',type:'fill',source:'beaches',paint:{'fill-pattern':'sand-grain'}},'building-lines')
app.onTime=redraw;app.onToggle=()=>{map.setLayoutProperty('mapped-trees','visibility','none');redraw()}
let zoomed=map.getZoom()>=15;map.on('zoomend',()=>{if(zoomed!==(map.getZoom()>=15)){zoomed=!zoomed;redraw()}})
redraw()
