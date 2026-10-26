import * as THREE from 'three'
import { GLTFLoader } from '../vendor/GLTFLoader.js'
import { mergeGeometries } from '../utils/BufferGeometryUtils.js'
import { scatter } from './scatter.js'

function flatten(model){
 const geometries=[];model.updateMatrixWorld(true)
 model.traverse(object=>{
  if(!object.isMesh)return
  let geometry=object.geometry.clone();if(geometry.index)geometry=geometry.toNonIndexed()
  geometry.applyMatrix4(object.matrixWorld)
  for(const attribute of Object.keys(geometry.attributes))if(!['position','normal','color'].includes(attribute))geometry.deleteAttribute(attribute)
  const color=object.material.color,existing=geometry.getAttribute('color'),colors=new Float32Array(geometry.attributes.position.count*3)
  for(let i=0;i<colors.length;i+=3){colors[i]=color.r*(existing?.getX(i/3)??1);colors[i+1]=color.g*(existing?.getY(i/3)??1);colors[i+2]=color.b*(existing?.getZ(i/3)??1)}
  geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));geometries.push(geometry)
 })
 const geometry=mergeGeometries(geometries);geometry.rotateX(Math.PI/2);geometry.computeBoundingBox()
 const bounds=geometry.boundingBox,height=bounds.max.z-bounds.min.z
 geometry.translate(-(bounds.max.x+bounds.min.x)/2,-(bounds.max.y+bounds.min.y)/2,-bounds.min.z)
 geometry.scale(1/height,1/height,1/height);return geometry
}
function decoration(name){
 const group=new THREE.Group(),material=new THREE.MeshBasicMaterial({color:name==='umbrella'?'#e99676':'#fff2cf'})
 if(name==='umbrella'){
  const canopy=new THREE.Mesh(new THREE.ConeGeometry(.8,.3,8),material);canopy.position.y=1;group.add(canopy)
  const pole=new THREE.Mesh(new THREE.CylinderGeometry(.025,.025,1,6),new THREE.MeshBasicMaterial({color:'#866847'}));pole.position.y=.5;group.add(pole)
 }else{const chair=new THREE.Mesh(new THREE.BoxGeometry(.5,.2,1.5),material);chair.position.y=.1;group.add(chair)}
 return flatten(group)
}
export async function props(app,scene){
 const loader=new GLTFLoader(),items=scatter(app),types=[...new Set(items.map(item=>item.model))],meshes=[]
 const loaded=await Promise.all(types.map(async type=>[type,['umbrella','lounger'].includes(type)?decoration(type):flatten((await loader.loadAsync(new URL(`../models/${type}.glb`,import.meta.url).href)).scene)]))
 const material=new THREE.MeshToonMaterial({vertexColors:true,side:THREE.DoubleSide})
 const dummy=new THREE.Object3D()
 for(const [type,geometry] of loaded){
  const instances=items.filter(item=>item.model===type),mesh=new THREE.InstancedMesh(geometry,material,instances.length)
  instances.forEach((item,index)=>{dummy.position.set(...item.position,.15);dummy.rotation.set(0,0,item.rotation);dummy.scale.setScalar(item.size);dummy.updateMatrix();mesh.setMatrixAt(index,dummy.matrix)})
  mesh.instanceMatrix.needsUpdate=true;mesh.frustumCulled=false;scene.add(mesh);meshes.push(mesh)
 }
 app.propInventory={instances:items.length,types:meshes.length,mapped:items.filter(item=>item.mapped).length}
 return ()=>{const visible=app.state.props&&app.map.getZoom()>=15;for(const mesh of meshes)mesh.visible=visible;app.propsCount=visible?items.length:0}
}
