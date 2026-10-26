import * as THREE from 'three'
import { boot } from '../boot.js'
import { threeLayer } from '../rendering/three-layer.js'
import { windows } from '../rendering/windows.js'

const app=await boot('neon'),{map}=app,scene=new THREE.Scene(),update=windows(app,scene)
map.addLayer({id:'road-glow',type:'line',source:'roads',paint:{'line-color':'#15758e','line-width':['interpolate',['linear'],['zoom'],14,2,18,12],'line-blur':5,'line-opacity':.6}},'building-bases')
map.addLayer({id:'road-light',type:'line',source:'roads',filter:['in',['get','kind'],['literal',['primary','secondary','tertiary','residential']]],paint:{'line-color':'#5acbd7','line-width':1,'line-opacity':.65}},'building-bases')
map.addLayer({id:'route-glow',type:'line',source:'routes',filter:['!=',['get','mode'],'straight'],paint:{'line-color':'#e748b9','line-width':15,'line-blur':9,'line-opacity':.7}},'route-shadow')
map.setPaintProperty('route-shadow','line-opacity',.25)
map.addLayer(threeLayer(app,'night-windows',scene,update),'route-shadow')
app.onTime=()=>{update();map.triggerRepaint()}
app.onToggle=(key,value)=>{if(key==='effects'){for(const id of ['road-glow','route-glow'])map.setLayoutProperty(id,'visibility',value?'visible':'none')}if(key==='routes')map.setLayoutProperty('route-glow','visibility',value&&app.state.effects?'visible':'none');update();map.triggerRepaint()}
if(!app.reduced){let previous=0;const pulse=now=>{if(now-previous>65){previous=now;const alpha=app.state.effects?.7+.25*Math.sin(now/650):1;map.setPaintProperty('route-line','line-opacity',alpha);for(const marker of app.markers)if(marker.getElement().classList.contains('bar'))marker.getElement().style.opacity=alpha}requestAnimationFrame(pulse)};requestAnimationFrame(pulse)}
app.onTime()
