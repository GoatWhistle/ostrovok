import * as THREE from 'three'
import { coordinates,polygons } from './coordinates.js'

export function waves(app,scene){
 const {point}=coordinates(app.data.meta.center),geometries=[]
 for(const feature of app.data.water.features)for(const rings of polygons(feature.geometry)){
  const shape=new THREE.Shape(rings[0].map(p=>new THREE.Vector2(...point(p))))
  shape.holes=rings.slice(1).map(ring=>new THREE.Path(ring.map(p=>new THREE.Vector2(...point(p)))))
  geometries.push(new THREE.ShapeGeometry(shape))
 }
 const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,uniforms:{time:{value:0},color:{value:new THREE.Color('#f1fff3')}},vertexShader:'varying vec2 p;void main(){p=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:'uniform float time;uniform vec3 color;varying vec2 p;void main(){float stripe=sin(p.y*.16+p.x*.05+sin(p.x*.02)*1.8-time*.55);float fade=smoothstep(.93,1.0,stripe)*.19;gl_FragColor=vec4(color,fade);}'})
 const meshes=geometries.map(geometry=>{const mesh=new THREE.Mesh(geometry,material);mesh.position.z=.35;mesh.frustumCulled=false;scene.add(mesh);return mesh})
 return time=>{material.uniforms.time.value=app.reduced?0:time;for(const mesh of meshes)mesh.visible=app.state.effects}
}
