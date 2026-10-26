function hull(points){
 const sorted=points.sort((a,b)=>a[0]-b[0]||a[1]-b[1]),cross=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]),lower=[],upper=[]
 for(const p of sorted){while(lower.length>=2&&cross(lower.at(-2),lower.at(-1),p)<=0)lower.pop();lower.push(p)}
 for(let i=sorted.length-1;i>=0;i--){const p=sorted[i];while(upper.length>=2&&cross(upper.at(-2),upper.at(-1),p)<=0)upper.pop();upper.push(p)}
 lower.pop();upper.pop();const ring=lower.concat(upper);ring.push(ring[0]);return ring
}
self.onmessage=({data})=>{
 const start=performance.now(),{buildings,sun,latitude}=data,features=[]
 if(sun.altitude>1){
  const angle=sun.azimuth*Math.PI/180,ratio=1/Math.tan(sun.altitude*Math.PI/180),metersLon=111320*Math.cos(latitude*Math.PI/180)
  for(const building of buildings){
   const length=Math.min(160,building.height*ratio),dx=-Math.sin(angle)*length/metersLon,dy=-Math.cos(angle)*length/111320
   const points=building.ring.flatMap(p=>[p,[p[0]+dx,p[1]+dy]])
   if(points.length>=6)features.push({type:'Feature',properties:{},geometry:{type:'Polygon',coordinates:[hull(points)]}})
  }
 }
 self.postMessage({type:'FeatureCollection',features,ms:performance.now()-start})
}
