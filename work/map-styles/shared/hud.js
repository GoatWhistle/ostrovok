export function startHud(app) {
  const samples=[];let last=performance.now(),start=last,frames=0,slowSince=0
  const output=document.querySelector('#performance')
  const frame=now=>{
    const duration=now-last;last=now;frames++
    samples.push(duration);if(samples.length>180)samples.shift()
    if(now-start>1000){
      const fps=frames*1000/(now-start),mean=samples.reduce((a,b)=>a+b,0)/samples.length
      app.metrics={fps,frameMs:mean,dpr:app.map.getPixelRatio(),buildings:app.deckBuildings??app.map.queryRenderedFeatures({layers:['building-volumes']}).length,props:app.propsCount??0,quality:app.quality}
      output.textContent=`${fps.toFixed(0)} FPS / ${mean.toFixed(1)} мс / DPR ${app.metrics.dpr.toFixed(1)}\n${app.metrics.buildings} зданий / ${app.metrics.props} предметов\n${app.quality}`
      if(now-app.started>5000&&mean>25){if(!slowSince)slowSince=now;if(now-slowSince>2000)degrade(app)}else slowSince=0
      start=now;frames=0
    }
    app.frame=requestAnimationFrame(frame)
  }
  app.frame=requestAnimationFrame(frame)
}

function degrade(app){
 if(app.quality==='полное качество'){
   app.state.props=false;app.onToggle?.('props',false);document.querySelector('#props').checked=false;app.quality='предметы отключены'
 }else if(app.quality==='предметы отключены'){
   app.state.effects=false;app.onToggle?.('effects',false);document.querySelector('#effects').checked=false;app.quality='эффекты отключены'
 }else if(app.map.getPixelRatio()>1.5){app.map.setPixelRatio(1.5);app.quality='DPR 1,5'}
}
