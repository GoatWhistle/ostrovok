export type MvtValue = string | number | boolean

export interface MvtFeature {
  readonly type: number
  readonly props: Readonly<Record<string, MvtValue>>
  readonly parts: readonly number[][]
}

export interface MvtLayer {
  readonly extent: number
  readonly features: readonly MvtFeature[]
}

class Reader {
  at = 0
  readonly bytes: Uint8Array
  readonly view: DataView

  constructor(bytes: Uint8Array, view: DataView) {
    this.bytes = bytes
    this.view = view
  }

  varint(): number {
    let result = 0
    let scale = 1
    for (;;) {
      const byte = this.bytes[this.at] ?? 0
      this.at += 1
      result += (byte & 0x7f) * scale
      if (byte < 0x80) return result
      scale *= 128
    }
  }

  slice(): Reader {
    const length = this.varint()
    const offset = this.bytes.byteOffset + this.at
    this.at += length
    return new Reader(
      new Uint8Array(this.bytes.buffer, offset, length),
      new DataView(this.bytes.buffer, offset, length),
    )
  }

  text(): string {
    const part = this.slice()
    return new TextDecoder().decode(part.bytes)
  }

  packed(): number[] {
    const part = this.slice()
    const out: number[] = []
    while (part.at < part.bytes.length) out.push(part.varint())
    return out
  }

  skip(wire: number) {
    if (wire === 0) this.varint()
    else if (wire === 1) this.at += 8
    else if (wire === 2) this.at += this.varint()
    else if (wire === 5) this.at += 4
  }

  done(): boolean {
    return this.at >= this.bytes.length
  }
}

function zigzag(value: number): number {
  return value % 2 === 1 ? -(value + 1) / 2 : value / 2
}

function readValue(reader: Reader): MvtValue {
  let value: MvtValue = ""
  while (!reader.done()) {
    const tag = reader.varint()
    const field = Math.floor(tag / 8)
    if (field === 1) value = reader.text()
    else if (field === 2) {
      value = reader.view.getFloat32(reader.at, true)
      reader.at += 4
    } else if (field === 3) {
      value = reader.view.getFloat64(reader.at, true)
      reader.at += 8
    } else if (field === 4 || field === 5) value = reader.varint()
    else if (field === 6) value = zigzag(reader.varint())
    else if (field === 7) value = reader.varint() === 1
    else reader.skip(tag & 7)
  }
  return value
}

function geometry(commands: readonly number[]): number[][] {
  const parts: number[][] = []
  let current: number[] = []
  let x = 0
  let y = 0
  let index = 0
  while (index < commands.length) {
    const command = commands[index] ?? 0
    index += 1
    const id = command & 7
    const count = command >> 3
    if (id === 7) {
      current.push(current[0] ?? 0, current[1] ?? 0)
      continue
    }
    for (let step = 0; step < count; step += 1) {
      x += zigzag(commands[index] ?? 0)
      y += zigzag(commands[index + 1] ?? 0)
      index += 2
      if (id === 1) {
        current = []
        parts.push(current)
      }
      current.push(x, y)
    }
  }
  return parts
}

function readFeature(reader: Reader, keys: readonly string[], values: readonly MvtValue[]) {
  let type = 0
  let tags: number[] = []
  let commands: number[] = []
  while (!reader.done()) {
    const tag = reader.varint()
    const field = Math.floor(tag / 8)
    if (field === 2) tags = reader.packed()
    else if (field === 3) type = reader.varint()
    else if (field === 4) commands = reader.packed()
    else reader.skip(tag & 7)
  }
  const props: Record<string, MvtValue> = {}
  for (let index = 0; index + 1 < tags.length; index += 2)
    props[keys[tags[index] ?? 0] ?? ""] = values[tags[index + 1] ?? 0] ?? ""
  return { type, props, parts: geometry(commands) }
}

function readLayer(reader: Reader): [string, MvtLayer] {
  let name = ""
  let extent = 4096
  const keys: string[] = []
  const values: MvtValue[] = []
  const raw: Reader[] = []
  while (!reader.done()) {
    const tag = reader.varint()
    const field = Math.floor(tag / 8)
    if (field === 1) name = reader.text()
    else if (field === 2) raw.push(reader.slice())
    else if (field === 3) keys.push(reader.text())
    else if (field === 4) values.push(readValue(reader.slice()))
    else if (field === 5) extent = reader.varint()
    else reader.skip(tag & 7)
  }
  return [name, { extent, features: raw.map((part) => readFeature(part, keys, values)) }]
}

export function decodeTile(buffer: ArrayBuffer): Map<string, MvtLayer> {
  const reader = new Reader(new Uint8Array(buffer), new DataView(buffer))
  const layers = new Map<string, MvtLayer>()
  while (!reader.done()) {
    const tag = reader.varint()
    if (Math.floor(tag / 8) !== 3) {
      reader.skip(tag & 7)
      continue
    }
    const [name, layer] = readLayer(reader.slice())
    const existing = layers.get(name)
    layers.set(
      name,
      existing
        ? { extent: layer.extent, features: [...existing.features, ...layer.features] }
        : layer,
    )
  }
  return layers
}
