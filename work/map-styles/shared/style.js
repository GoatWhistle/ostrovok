import { classColor } from './palettes.js'

export function baseStyle(palette, scene) {
  const source = { type:'vector', url:`pmtiles://${new URL(`./data/${scene}.pmtiles`,import.meta.url).href}` }
  const layers = basemaps.layers('base',basemaps.namedFlavor(palette.flavor),{lang:'ru'}).filter(layer=>!layer.id.includes('buildings'))
  for (const layer of layers) {
    const sourceLayer=layer['source-layer']
    if(layer.type==='background')layer.paint['background-color']=palette.land
    if(layer.type==='fill'&&sourceLayer==='water')layer.paint['fill-color']=palette.water
    if(layer.type==='fill'&&sourceLayer==='landuse')layer.paint['fill-color']=palette.park
    if(layer.type==='line'&&sourceLayer==='roads')layer.paint['line-color']=layer.id.includes('casing')?palette.casing:palette.road
    if(layer.type==='symbol'&&palette.flavor==='black'){
      layer.paint??={}
      layer.paint['text-color']='#bdd4e4';layer.paint['text-halo-color']=palette.land
    }
  }
  return { version:8, glyphs:new URL('./fonts/{fontstack}/{range}.pbf',import.meta.url).href.replaceAll('%7B','{').replaceAll('%7D','}'),
    sprite:new URL(`./sprites/${palette.flavor==='black'?'black':'light'}`,import.meta.url).href,sources:{base:source},layers }
}

export function paintData(app) {
  const {map,data,palette}=app
  for(const key of ['ground','water','roads','buildings','trees','beaches','coast','routes'])map.addSource(key,{type:'geojson',data:data[key],...(key==='routes'?{lineMetrics:true}:{})})
  const labels=map.getStyle().layers.find(layer=>layer.type==='symbol')?.id
  const colors=['match',['get','class']]
  for(const key of ['hotel','house','apartments','residence','retail','office','factory','warehouse','school','hospital','worship'])colors.push(key,classColor(key,palette))
  colors.push(palette.buildings)
  map.addLayer({id:'local-water',type:'fill',source:'water',paint:{'fill-color':palette.water}},labels)
  map.addLayer({id:'local-beach',type:'fill',source:'beaches',paint:{'fill-color':palette.sand}},labels)
  map.addLayer({id:'local-ground',type:'fill',source:'ground',filter:['in',['get','class'],['literal',['park','garden','grass','forest','wood','scrub']]],paint:{'fill-color':palette.park,'fill-opacity':0.6}},labels)
  map.addLayer({id:'local-coast',type:'line',source:'coast',paint:{'line-color':palette.outline,'line-width':1.3}},labels)
  map.addLayer({id:'building-bases',type:'fill',source:'buildings',paint:{'fill-color':palette.outline,'fill-opacity':0.3}},labels)
  map.addLayer({id:'building-volumes',type:'fill-extrusion',source:'buildings',paint:{'fill-extrusion-color':colors,'fill-extrusion-height':['max',2,['get','height']],'fill-extrusion-opacity':1,'fill-extrusion-vertical-gradient':true}},labels)
  map.addLayer({id:'building-lines',type:'line',source:'buildings',paint:{'line-color':palette.outline,'line-width':app.kind==='toy'?1.8:0.6}},labels)
  map.addLayer({id:'mapped-trees',type:'circle',source:'trees',minzoom:15,paint:{'circle-color':palette.park,'circle-stroke-color':palette.outline,'circle-stroke-width':1,'circle-radius':3}})
  map.addLayer({id:'route-shadow',type:'line',source:'routes',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':palette.land,'line-width':9,'line-opacity':0.85}})
  map.addLayer({id:'route-line',type:'line',source:'routes',filter:['!=',['get','mode'],'straight'],layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':palette.route,'line-width':4}})
  map.addLayer({id:'route-straight',type:'line',source:'routes',filter:['==',['get','mode'],'straight'],paint:{'line-color':palette.route,'line-width':3,'line-dasharray':[2,2]}})
  map.setLight({anchor:'map',color:'#fff8e9',intensity:0.6,position:[1.5,220,45]})
}
