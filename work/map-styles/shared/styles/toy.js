import * as THREE from 'three'
import { boot } from '../boot.js'
import { shadows } from '../rendering/shadows.js'
import { props } from '../rendering/props.js'
import { waves } from '../rendering/waves.js'
import { threeLayer } from '../rendering/three-layer.js'

const app=await boot('toy'),scene=new THREE.Scene(),sun=new THREE.DirectionalLight('#fff5df',2.5)
scene.add(new THREE.AmbientLight('#ffffff',2));scene.add(sun)
const updateProps=await props(app,scene),updateWaves=waves(app,scene),updateShadows=shadows(app)
app.map.setLayoutProperty('mapped-trees','visibility','none')
app.map.setPaintProperty('building-bases','fill-translate',[3,4])
app.map.addLayer(threeLayer(app,'toy-props',scene,time=>{updateProps();updateWaves(time)}),'route-shadow')
app.onTime=()=>{updateShadows();const az=app.sun.azimuth*Math.PI/180,alt=app.sun.altitude*Math.PI/180;sun.position.set(Math.sin(az)*100,-Math.cos(az)*100,Math.max(10,Math.sin(alt)*100));app.map.triggerRepaint()}
app.onToggle=()=>{updateProps();updateShadows();app.map.setLayoutProperty('mapped-trees','visibility','none');app.map.triggerRepaint()};app.onTime()
