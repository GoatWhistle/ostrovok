import { MercatorCoordinate } from '../vendor/maplibre-gl.mjs'

export function coordinates(center){
 const origin=MercatorCoordinate.fromLngLat(center),scale=origin.meterInMercatorCoordinateUnits()
 return {origin,scale,point:location=>{const point=MercatorCoordinate.fromLngLat(location);return [(point.x-origin.x)/scale,(point.y-origin.y)/scale]}}
}
export function polygons(geometry){return (geometry.type==='Polygon'?[geometry.coordinates]:geometry.type==='MultiPolygon'?geometry.coordinates:[]).filter(rings=>rings[0]?.length>=4)}
export function inside(point,ring){
 let result=false
 for(let i=0,j=ring.length-1;i<ring.length;j=i++){
  const [x,y]=ring[i],[a,b]=ring[j]
  if((y>point[1])!==(b>point[1])&&point[0]<(a-x)*(point[1]-y)/(b-y)+x)result=!result
 }
 return result
}
export function random(seed){let value=seed;return ()=>{value=(Math.imul(value,1664525)+1013904223)>>>0;return value/4294967296}}
