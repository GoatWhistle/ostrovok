import * as THREE from 'three'
import { coordinates } from './coordinates.js'

export function threeLayer(app,id,scene,update){
 const coord=coordinates(app.data.meta.center),camera=new THREE.Camera()
 const transform=new THREE.Matrix4().makeTranslation(coord.origin.x,coord.origin.y,0).scale(new THREE.Vector3(coord.scale,coord.scale,coord.scale))
 const projection=new THREE.Matrix4()
 let renderer
 return {id,type:'custom',renderingMode:'3d',onAdd(map,gl){
  renderer=new THREE.WebGLRenderer({canvas:map.getCanvas(),context:gl,antialias:true});renderer.autoClear=false
  renderer.outputColorSpace=THREE.SRGBColorSpace
 },render(gl,options){
  update?.(performance.now()/1000)
  projection.fromArray(options.defaultProjectionData.mainMatrix)
  camera.projectionMatrix.copy(projection).multiply(transform)
  renderer.resetState();renderer.render(scene,camera);renderer.resetState()
  if(!app.reduced&&app.state.effects)app.map.triggerRepaint()
 },onRemove(){scene.traverse(object=>{object.geometry?.dispose();if(object.material)for(const item of Array.isArray(object.material)?object.material:[object.material])item.dispose()});renderer.dispose()}}
}
