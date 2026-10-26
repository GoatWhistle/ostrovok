import { polygons } from './coordinates.js'

export function shadows(app){
 const worker=new Worker(new URL('./shadows-worker.js',import.meta.url)),{map}=app
 const buildings=app.data.buildings.features.flatMap(feature=>polygons(feature.geometry).map(rings=>({ring:rings[0],height:feature.properties.height})))
 map.addSource('sun-shadows',{type:'geojson',data:{type:'FeatureCollection',features:[]}})
 map.addLayer({id:'sun-shadows',type:'fill',source:'sun-shadows',minzoom:15,paint:{'fill-color':'#514b47','fill-opacity':.18}},'building-bases')
 worker.onmessage=({data})=>{app.shadowWorkerMs=data.ms;delete data.ms;map.getSource('sun-shadows').setData(data)}
 const update=()=>{map.setLayoutProperty('sun-shadows','visibility',app.state.effects?'visible':'none');if(app.state.effects)worker.postMessage({buildings,sun:app.sun,latitude:app.data.meta.center[1]})}
 map.on('remove',()=>worker.terminate());update();return update
}
