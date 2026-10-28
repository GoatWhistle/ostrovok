const fs = require("node:fs")
const path = require("node:path")
const directory = process.argv[2] ?? "work/map-night/before/grid"
const linear = value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
function rgb(color) {
  if (Array.isArray(color)) return color
  if (!/^#[0-9a-f]{6}$/i.test(color ?? "")) return null
  return [1,3,5].map(offset => Number.parseInt(color.slice(offset, offset+2),16)/255)
}
function lab(color) {
  const channels = rgb(color)
  if (!channels) return null
  const [r,g,b] = channels.map(linear)
  const l = Math.cbrt(.4122214708*r+.5363325363*g+.0514459929*b)
  const m = Math.cbrt(.2119034982*r+.6806995451*g+.1073969566*b)
  const s = Math.cbrt(.0883024619*r+.2817188376*g+.6299787005*b)
  return [.2104542553*l+.793617785*m-.0040720468*s,1.9779984951*l-2.428592205*m+.4505937099*s,.0259040371*l+.7827717662*m-.808675766*s]
}
function delta(a,b) {
  const x=lab(a), y=lab(b)
  return x && y ? Math.hypot(...x.map((value,index)=>value-y[index]))*100 : null
}
function luminance(color) {
  const channels=rgb(color)
  return channels ? channels.map(linear).reduce((sum,value,index)=>sum+value*[.2126,.7152,.0722][index],0) : null
}
function contrast(a,b) {
  const x=luminance(a), y=luminance(b)
  return x===null || y===null ? null : (Math.max(x,y)+.05)/(Math.min(x,y)+.05)
}
function minimum(a,b) {
  if (!a?.length || !b?.length) return null
  return Math.min(...a.flatMap(x=>b.map(y=>delta(x,y))))
}
function pairwise(colors) {
  if (!colors?.length) return null
  const unique=[...new Map(colors.map(value=>[JSON.stringify(value),value])).values()]
  return unique.length<2 ? null : Math.min(...unique.flatMap((a,i)=>unique.slice(i+1).map(b=>delta(a,b))))
}
function classColor(expression,key) {
  if (!Array.isArray(expression)) return expression
  if (expression[0]!=="match") return null
  for (let i=2;i<expression.length-1;i+=2) if (expression[i]===key) return expression[i+1]
  return expression.at(-1)
}
function metric(value,threshold) {return {value,threshold,passed:value!==null&&value>=threshold}}
function analyze(snapshot) {
  const layers=snapshot.style.layers
  const paint=(id,key)=>layers.find(layer=>layer.id===id)?.paint?.[key]
  const ground=paint("base-landcover","fill-color")
  const background=paint("canvas","background-color")
  const land=Array.isArray(background)?background.at(-1):background
  const park=classColor(ground,"park")
  const water=classColor(paint("base-water","fill-color"),"water")
  const roadLight=paint("base-roads-light","line-color")
  const label=layers.find(layer=>layer.id.startsWith("basemap-")&&layer.paint?.["text-color"])?.paint
  const roofs=snapshot.roofs?.palette?.slice(0,5)
  const plaster=snapshot.roofs?.palette?.slice(10,16)
  const leaves=snapshot.trees?.palette?.slice(0,4)
  const rig=snapshot.roofs
  const wallRatio=rig ? luminance(rig.ambient.map((value,i)=>Math.min(1,value+rig.light[i])))/luminance(rig.ambient):null
  return {look:snapshot.look,hour:snapshot.hour,colors:{land,park,water,roadLight,label,roofs,plaster,leaves},metrics:{
    parkLand:metric(delta(park,land),6),waterLand:metric(delta(water,land),7.5),sandLand:metric(delta(paint("base-beaches","fill-color"),land),3),
    plasterTones:metric(pairwise(plaster),1.1),roofTones:metric(pairwise(roofs),4.5),roofPlaster:metric(minimum(roofs,plaster),4.5),
    leafTones:metric(pairwise(leaves),1.9),leafPark:metric(minimum(leaves,park?[park]:null),6),
    roadLand:metric(contrast(roadLight,land),3),labelLand:metric(contrast(label?.["text-color"],land),4.5),labelHalo:metric(contrast(label?.["text-color"],label?.["text-halo-color"]),4.5),
    wallLight:metric(wallRatio,1.3)
  }}
}
const snapshots=fs.readdirSync(directory).filter(name=>/^(toy-town|neon)-\d+\.json$/.test(name)).map(name=>analyze(JSON.parse(fs.readFileSync(path.join(directory,name),"utf8"))))
const report={method:"Oklab Euclidean distance ×100; WCAG luminance ratio; unique material tones; actual getStyle and mesh lighting. Wall ratio is full-normal upper bound, not a rendered facet measurement.",samples:snapshots.length,expectedSamples:48,complete:snapshots.length===48,results:snapshots}
fs.writeFileSync(path.join(directory,"contrast-report.json"),JSON.stringify(report,null,2))
console.log(JSON.stringify({samples:snapshots.length,failed:snapshots.flatMap(row=>Object.entries(row.metrics).filter(([,m])=>!m.passed).map(([key,m])=>({look:row.look,hour:row.hour,key,...m})))},null,2))
