import * as THREE from 'three'
import { mergeGeometries } from '../utils/BufferGeometryUtils.js'
import { coordinates,polygons } from './coordinates.js'

export function windows(app,scene){
 const {point}=coordinates(app.data.meta.center),parts=[]
 for(const feature of app.data.buildings.features)for(const rings of polygons(feature.geometry)){
  const shape=new THREE.Shape(rings[0].map(p=>new THREE.Vector2(...point(p))))
  shape.holes=rings.slice(1).map(r=>new THREE.Path(r.map(p=>new THREE.Vector2(...point(p)))))
  const geometry=new THREE.ExtrudeGeometry(shape,{depth:Math.max(2,feature.properties.height)+.08,bevelEnabled:false,steps:1,curveSegments:1})
  parts.push(geometry)
 }
 const geometry=mergeGeometries(parts);parts.forEach(g=>g.dispose())
 const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,uniforms:{intensity:{value:1}},
 vertexShader:'varying vec3 p;varying vec3 n;void main(){p=position;n=normal;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
 fragmentShader:'uniform float intensity;varying vec3 p;varying vec3 n;void main(){float horizontal=abs(n.x)>.5?p.y:p.x;vec2 cell=fract(vec2(horizontal/3.1,p.z/3.2));float hash=fract(sin(dot(floor(vec2(horizontal/3.1,p.z/3.2)),vec2(12.9898,78.233)))*43758.5453);float light=step(.35,hash)*step(.22,cell.x)*step(cell.x,.7)*step(.25,cell.y)*step(cell.y,.68)*(1.-step(.5,abs(n.z)));if(light<.5)discard;vec3 tint=mix(vec3(.18,.8,1.),vec3(1.,.65,.25),step(.65,hash));gl_FragColor=vec4(tint,intensity*.85);}'})
 const mesh=new THREE.Mesh(geometry,material);mesh.frustumCulled=false;scene.add(mesh)
 return ()=>{mesh.visible=app.state.effects&&app.map.getZoom()>=15;material.uniforms.intensity.value=app.sun.altitude>10?.15:1}
}
