import { inside, polygons, random, coordinates } from './coordinates.js'

export function scatter(app){
 const {point}=coordinates(app.data.meta.center),items=[],rng=random(271828),occupied=new Map()
 const add=(model,position,size,mapped=false)=>{
  const key=`${Math.floor(position[0]/7)}:${Math.floor(position[1]/7)}`
  const gx=Math.floor(position[0]/7),gy=Math.floor(position[1]/7)
  for(let x=gx-1;x<=gx+1;x++)for(let y=gy-1;y<=gy+1;y++){const other=occupied.get(`${x}:${y}`);if(other&&Math.hypot(other[0]-position[0],other[1]-position[1])<7)return}
  occupied.set(key,position);items.push({model,position,size,rotation:rng()*Math.PI*2,mapped})
 }
 for(const feature of app.data.trees.features)add(['pine','oak','palm'][Math.floor(rng()*3)],point(feature.geometry.coordinates),5+rng()*4,true)
 for(const feature of app.data.ground.features){
  if(!['forest','wood','park','garden','grass'].includes(feature.properties.class))continue
  for(const rings of polygons(feature.geometry)){
   const ring=rings[0].map(point),holes=rings.slice(1).map(r=>r.map(point)),xs=ring.map(p=>p[0]),ys=ring.map(p=>p[1])
   const x0=Math.min(...xs),y0=Math.min(...ys),width=Math.max(...xs)-x0,height=Math.max(...ys)-y0
   const count=Math.min(80,Math.floor(width*height/600))
   for(let i=0;i<count;i++){
    const position=[x0+rng()*width,y0+rng()*height]
    if(inside(position,ring)&&!holes.some(h=>inside(position,h)))add(i%8===0?'bush':i%5===0?'bench':i%7===0?'lamp':i%3===0?'oak':'pine',position,i%8===0?1.8:i%5===0?1:i%7===0?3:5+rng()*3)
   }
  }
 }
 for(const beach of app.data.beaches.features)for(const rings of polygons(beach.geometry)){
  const ring=rings[0].map(point),xs=ring.map(p=>p[0]),ys=ring.map(p=>p[1]),x0=Math.min(...xs),y0=Math.min(...ys)
  for(let i=0;i<70;i++){
   const position=[x0+rng()*(Math.max(...xs)-x0),y0+rng()*(Math.max(...ys)-y0)]
   if(inside(position,ring))add(i%7===0?'cafe-tent':i%2===0?'umbrella':'lounger',position,i%7===0?3.5:2.3)
  }
 }
 for(const feature of app.data.ground.features)if(feature.properties.class==='pier'){
  const ring=polygons(feature.geometry)[0]?.[0];if(ring){const position=point(ring[0]);add('rowboat',[position[0]+5,position[1]+3],1.2)}}
 return items.slice(0,1500)
}
