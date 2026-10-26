import { Marker } from './vendor/maplibre-gl.mjs'

export function addPins(app) {
  const {data,map}=app
  const walk=data.routes.features.find(feature=>feature.properties.place_id===data.meta.bar.id)?.properties
  const barLabel=walk?.mode==='straight'?`${data.meta.bar.name}: по прямой ~${Math.round(walk.distance_m)} м`:data.meta.bar.name
  const entries=[{location:data.meta.hotel.location,text:data.meta.hotel.name,kind:'hotel',face:'О!'},
    {location:data.meta.neighbors[0].location,text:'2 соседних отеля',kind:'cluster',face:'2'},
    {location:data.meta.bar.location,text:barLabel,kind:'bar',face:walk?.mode==='straight'?`~${Math.round(walk.distance_m)} м`:'Бар'}]
  const route=data.routes.features.find(feature=>feature.properties.kind==='sea')
  if(route)entries.push({location:route.geometry.coordinates.at(-1),text:'Пешком до моря',kind:'route',face:'К морю'})
  const markers=entries.map((entry,index)=>{
    const element=document.createElement('button');element.className=`map-pin ${entry.kind}`
    element.type='button';element.setAttribute('aria-label',entry.text);element.innerHTML=`<b></b><span></span>`
    element.querySelector('b').textContent=entry.face;element.querySelector('span').textContent=entry.text
    element.addEventListener('click',()=>{document.querySelector('#selection').textContent=entry.text;map.easeTo({center:entry.location,zoom:17,duration:app.reduced?0:400})})
    const marker=new Marker({element,anchor:'bottom',offset:index===1?[52,-52]:[0,0]}).setLngLat(entry.location).addTo(map)
    return marker
  })
  app.markers=markers
}
