import {
  ACESFilmicToneMapping,
  BufferGeometry,
  Color,
  DirectionalLight,
  Fog,
  HemisphereLight,
  Mesh,
  MeshLambertMaterial,
  PCFShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  Points,
  Scene,
  SphereGeometry,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
  Float32BufferAttribute,
} from "three"
import { atmosphereAt } from "./atmosphere"
import { buildBuildings, buildFootprint } from "./build-buildings"
import { buildGround, buildRoads, lampPositions } from "./build-ground"
import { buildTrees } from "./build-trees"
import { blendShots, type CameraPath, type Shot, shotAt } from "./camera-path"
import { CITY, HERO_ID, hotelBuildings } from "./city-data"
import { beams, Fader, glowMaterial, ribbon, walls } from "./highlights"
import { buildingMaterial, flatMaterial, lampMaterial, seaMaterial, skyMaterial, treeMaterial } from "./materials"
import { token } from "./palette"

export type Clock =
  | { readonly kind: "fixed"; readonly hour: number }
  | { readonly kind: "sweep"; readonly from: number; readonly to: number; readonly seconds: number }

export type Highlight = "hero" | "found" | "route" | "facade" | "noise" | "hotels" | "coast" | "walk" | "grow" | "trees"

export interface Direction {
  readonly path: CameraPath
  readonly clock: Clock
  readonly highlights: readonly Highlight[]
  readonly shift?: number
  readonly hidden?: boolean
}

const FLIGHT = 2.6

export class CityScene {
  private readonly renderer: WebGLRenderer
  private readonly scene = new Scene()
  private readonly camera = new PerspectiveCamera(38, 16 / 9, 2, 40000)
  private readonly sunLight = new DirectionalLight(0xffffff, 2)
  private readonly ambient = new HemisphereLight(0xffffff, 0x888888, 1)
  private readonly sky = new Mesh(new SphereGeometry(30000, 32, 16), skyMaterial())
  private readonly sea = new Mesh(new PlaneGeometry(80000, 80000), seaMaterial())
  private readonly night = { value: 0 }
  private readonly grow = { value: 1 }
  private readonly treeGrow = { value: 1 }
  private readonly faders = new Map<Highlight, Fader>()
  private readonly heroCenter: [number, number, number] = [0, 0, 30]
  private direction: Direction | undefined
  private from: Shot = { x: 0, y: 0, distance: 3200, pitch: 55, bearing: 20 }
  private shot: Shot = this.from
  private started = 0
  private hour = 12
  private hourFrom = 12
  private clockStarted = 0
  private last = 0
  private frame = 0
  private growTarget = 1
  private shift = 0
  private lastDelta = 0.016
  private treeTarget = 1

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
    this.renderer.outputColorSpace = SRGBColorSpace
    this.renderer.toneMapping = ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.05
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = PCFShadowMap
    this.scene.fog = new Fog(0xffffff, 1500, 9000)
    this.build()
    this.resize()
    window.addEventListener("resize", this.resize)
    this.frame = requestAnimationFrame(this.tick)
  }

  private build() {
    const hotels = hotelBuildings()
    const hotelIndexes = new Set(hotels.values())
    const buildings = buildBuildings(hotelIndexes)
    const buildingMesh = new Mesh(buildings.geometry, buildingMaterial(this.night, this.grow))
    buildingMesh.castShadow = true
    buildingMesh.receiveShadow = true
    const ground = new Mesh(buildGround(), flatMaterial())
    ground.receiveShadow = true
    const roads = new Mesh(buildRoads(), flatMaterial())
    roads.receiveShadow = true
    const material = treeMaterial()
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uTreeGrow = this.treeGrow
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nuniform float uTreeGrow;")
        .replace("#include <begin_vertex>", "#include <begin_vertex>\ntransformed *= uTreeGrow;")
    }
    const trees = buildTrees(material)
    const lampGeometry = new BufferGeometry()
    lampGeometry.setAttribute("position", new Float32BufferAttribute(lampPositions(), 3))
    const lamps = new Points(lampGeometry, lampMaterial(this.night))
    this.sea.rotation.x = -Math.PI / 2
    this.sea.position.y = -0.6
    this.sky.frustumCulled = false
    this.scene.add(this.sky, this.sea, ground, roads, buildingMesh, trees.mesh, lamps, this.ambient, this.sunLight, this.sunLight.target)
    this.sunLight.castShadow = true
    this.sunLight.shadow.mapSize.set(2048, 2048)
    this.sunLight.shadow.bias = -0.0004
    this.sunLight.shadow.normalBias = 0.6
    this.addHighlights(hotels)
  }

  private addHighlights(hotels: Map<string, number>) {
    const lime = token("--action-fact")
    const cyan = token("--action-primary").clone().lerp(new Color("#38d6e8"), 0.45)
    const heroIndex = hotels.get(HERO_ID)
    const heroEntry = heroIndex === undefined ? undefined : CITY.buildings[heroIndex]
    const heroHeight = heroEntry?.[0] ?? 28
    this.heroCenter[2] = heroHeight
    const heroGeometry = heroIndex === undefined ? new BufferGeometry() : buildFootprint(heroIndex, 0.6)
    heroGeometry.computeBoundingBox()
    const box = heroGeometry.boundingBox
    const cx = box ? (box.min.x + box.max.x) / 2 : 0
    const cz = box ? (box.min.z + box.max.z) / 2 : 0
    heroGeometry.translate(-cx, 0, -cz)
    heroGeometry.scale(1.04, 1, 1.04)
    heroGeometry.translate(cx, 0, cz)
    const heroMesh = new Mesh(
      heroGeometry,
      new MeshLambertMaterial({ color: lime, emissive: lime, emissiveIntensity: 0.35 }),
    )
    heroMesh.castShadow = true
    const heroFader = new Fader([])
    heroFader.group.add(heroMesh)
    this.faders.set("hero", heroFader)
    const hotelBase = (id: string, x: number, y: number): [number, number, number] => {
      const index = hotels.get(id)
      const height = index === undefined ? 10 : (CITY.buildings[index]?.[0] ?? 10)
      return [x, y, height + 2]
    }
    const found = CITY.hotels.filter(([id]) => CITY.found.includes(id)).map(([id, , x, y]) => hotelBase(id, x, y))
    this.faders.set("found", new Fader([beams(found, lime, 160)]))
    const all = CITY.hotels.map(([id, , x, y]) => hotelBase(id, x, y))
    this.faders.set("hotels", new Fader([beams(all, cyan, 90)]))
    const routeMaterial = glowMaterial(token("--action-primary"), 3)
    routeMaterial.depthWrite = true
    routeMaterial.polygonOffset = true
    routeMaterial.polygonOffsetFactor = -4
    this.faders.set("route", new Fader([new Mesh(ribbon([CITY.route], 6, 1.6), routeMaterial)], 1.6))
    this.faders.set("facade", new Fader([new Mesh(walls(CITY.facades, heroHeight + 6), glowMaterial(token("--action-primary"), 0.9))]))
    const noiseLines = CITY.noise.filter(([, flat]) => flat.length >= 4).map(([, flat]) => flat)
    this.faders.set("noise", new Fader([new Mesh(ribbon(noiseLines, 16, 0.7), glowMaterial(new Color("#ff6b4a"), 0.9))], 3))
    this.faders.set("coast", new Fader([new Mesh(ribbon(CITY.land, 14, 0.5), glowMaterial(cyan, 1))]))
    const walkLines = CITY.roads
      .filter(([kind]) => ["road_footway", "road_path", "road_pedestrian", "road_cycleway"].includes(kind))
      .map(([, flat]) => flat)
    this.faders.set("walk", new Fader([new Mesh(ribbon(walkLines, 3, 0.4), glowMaterial(cyan, 0.8))], 3))
    for (const fader of this.faders.values()) this.scene.add(fader.group)
  }

  direct(direction: Direction) {
    const now = performance.now() / 1000
    this.from = this.shot
    this.started = now
    this.hourFrom = this.hour
    this.clockStarted = now
    const previous = new Set(this.direction?.highlights ?? [])
    this.direction = direction
    for (const [key, fader] of this.faders) {
      const on = direction.highlights.includes(key)
      fader.set(on, on && !previous.has(key))
    }
    const growing = direction.highlights.includes("grow")
    if (growing && !previous.has("grow")) this.grow.value = 0.02
    this.growTarget = 1
    const trees = direction.highlights.includes("trees")
    if (trees && !previous.has("trees")) this.treeGrow.value = 0.01
    this.treeTarget = 1
  }

  heroAnchor(): readonly [number, number, number] {
    return this.heroCenter
  }

  project(x: number, y: number, height: number): { x: number; y: number; visible: boolean } {
    const vector = new Vector3(x, height, -y).project(this.camera)
    return { x: (vector.x + 1) / 2, y: (1 - vector.y) / 2, visible: vector.z < 1 }
  }

  private resize = () => {
    const canvas = this.renderer.domElement
    const width = canvas.clientWidth || window.innerWidth
    const height = canvas.clientHeight || window.innerHeight
    this.renderer.setSize(width, height, false)
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
  }

  private updateClock(now: number) {
    const clock = this.direction?.clock ?? { kind: "fixed", hour: 12 }
    const elapsed = now - this.clockStarted
    const target = clock.kind === "fixed" ? clock.hour : clock.from
    let delta = target - this.hourFrom
    while (delta > 12) delta -= 24
    while (delta < -12) delta += 24
    if (elapsed < FLIGHT) {
      const t = elapsed / FLIGHT
      this.hour = this.hourFrom + delta * t * t * (3 - 2 * t)
    } else if (clock.kind === "sweep") {
      const phase = ((elapsed - FLIGHT) / clock.seconds) * Math.PI * 2
      this.hour = clock.from + (clock.to - clock.from) * (0.5 - 0.5 * Math.cos(phase))
    } else {
      this.hour = target
    }
    this.hour = ((this.hour % 24) + 24) % 24
  }

  private updateCamera(now: number) {
    const direction = this.direction
    if (!direction) return
    const elapsed = now - this.started
    const target = shotAt(direction.path, Math.max(0, elapsed - FLIGHT))
    this.shot = elapsed < FLIGHT ? blendShots(this.from, target, elapsed / FLIGHT) : target
    const shot = this.shot
    const pitch = (shot.pitch * Math.PI) / 180
    const bearing = (shot.bearing * Math.PI) / 180
    const horizontal = Math.sin(pitch) * shot.distance
    const forward = new Vector3(Math.sin(bearing), 0, -Math.cos(bearing))
    const focus = new Vector3(shot.x, 0, -shot.y)
    this.shift += ((direction.shift ?? 0) - this.shift) * Math.min(1, this.lastDelta * 1.5)
    const right = new Vector3(Math.cos(bearing), 0, Math.sin(bearing))
    focus.addScaledVector(right, this.shift * shot.distance)
    this.camera.position.copy(focus).addScaledVector(forward, -horizontal)
    this.camera.position.y = Math.cos(pitch) * shot.distance
    this.camera.lookAt(focus)
    const fog = this.scene.fog as Fog
    fog.near = shot.distance * 1.4
    fog.far = shot.distance * 6 + 3000
  }

  private updateLight(now: number) {
    const air = atmosphereAt(this.hour)
    this.night.value = air.night
    const [sx, sy, sz] = air.sunDirection
    const focus = new Vector3(this.shot.x, 0, -this.shot.y)
    this.sunLight.position.set(focus.x + sx * 2000, sy * 2000, focus.z + sz * 2000)
    this.sunLight.target.position.copy(focus)
    const span = Math.min(1600, Math.max(300, this.shot.distance * 0.9))
    const shadow = this.sunLight.shadow.camera
    shadow.left = -span
    shadow.right = span
    shadow.top = span
    shadow.bottom = -span
    shadow.near = 10
    shadow.far = 5000
    shadow.updateProjectionMatrix()
    this.sunLight.color.copy(air.sunColor)
    this.sunLight.intensity = air.sunIntensity
    this.ambient.color.copy(air.ambientSky)
    this.ambient.groundColor.copy(air.ambientGround)
    this.ambient.intensity = air.ambientIntensity
    const sky = this.sky.material.uniforms as Record<string, { value: any }>
    sky.uZenith!.value.copy(air.zenith)
    sky.uHorizon!.value.copy(air.horizon)
    sky.uGlow!.value.copy(air.glow)
    sky.uSun!.value = [sx, sy, sz]
    sky.uGlowStrength!.value = air.glowStrength
    this.sky.position.copy(this.camera.position)
    const sea = this.sea.material.uniforms as Record<string, { value: any }>
    sea.uColor!.value.copy(air.sea)
    sea.uDeep!.value.copy(air.seaDeep)
    sea.uSun!.value = [sx, sy, sz]
    sea.uSunColor!.value.copy(air.sunColor)
    sea.uTime!.value = now
    const fogColor = (this.scene.fog as Fog).color
    sea.fogColor!.value.copy(fogColor)
    sea.fogNear!.value = (this.scene.fog as Fog).near
    sea.fogFar!.value = (this.scene.fog as Fog).far
    ;(this.scene.fog as Fog).color.copy(air.fog)
    this.scene.background = air.horizon
  }

  private tick = (time: number) => {
    const now = time / 1000
    const delta = this.last ? Math.min(0.1, now - this.last) : 0.016
    this.last = now
    this.lastDelta = delta
    this.updateClock(now)
    this.updateCamera(now)
    this.updateLight(now)
    this.grow.value += (this.growTarget - this.grow.value) * Math.min(1, delta * 0.9)
    this.treeGrow.value += (this.treeTarget - this.treeGrow.value) * Math.min(1, delta * 1.4)
    for (const fader of this.faders.values()) fader.update(delta, now)
    if (!this.direction?.hidden) this.renderer.render(this.scene, this.camera)
    this.frame = requestAnimationFrame(this.tick)
  }

  currentHour() {
    return this.hour
  }

  dispose() {
    cancelAnimationFrame(this.frame)
    window.removeEventListener("resize", this.resize)
    this.renderer.dispose()
  }
}
