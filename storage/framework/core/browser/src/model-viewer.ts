/** Dependency-free, on-demand WebGL model inspection. No application boot or globals. */
export type ModelVector = [number, number, number]
export type ModelMatrix = number[]
export type ModelGeometry =
  | { kind: 'stl', src: string }
  | { kind: 'mesh', vertices: ModelVector[], triangles: [number, number, number][] }
  | { kind: 'box', size: ModelVector }
  | { kind: 'tube', outer: number, inner: number, length: number }
  | { kind: 'cylinder', radius: number, length: number, innerRadius?: number, segments?: number }

export interface ModelNode {
  id: string
  geometry: ModelGeometry
  color?: string
  transform?: ModelMatrix
}

export interface ModelScene { nodes: ModelNode[] }
export interface ModelViewerOptions {
  onStatus?: (status: 'loading' | 'ready' | 'error', message?: string) => void
  background?: ModelVector
}
export interface ModelViewerController {
  setScene: (scene: ModelScene) => Promise<void>
  view: (preset: 'home' | 'front' | 'side' | 'top') => void
  zoom: (factor: number) => void
  dispose: () => void
}

const radians = (value: number) => value * Math.PI / 180
const identity = (): ModelMatrix => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
const sub = (a: ModelVector, b: ModelVector): ModelVector => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const cross = (a: ModelVector, b: ModelVector): ModelVector => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const dot = (a: ModelVector, b: ModelVector): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const unit = (v: ModelVector): ModelVector => { const length = Math.hypot(...v) || 1; return v.map(n => n / length) as ModelVector }

export function multiplyModelMatrices(a: ModelMatrix, b: ModelMatrix): ModelMatrix {
  const result = Array.from({ length: 16 }, () => 0)
  for (let column = 0; column < 4; column++) {
    for (let row = 0; row < 4; row++) {
      for (let k = 0; k < 4; k++)
        result[column * 4 + row]! += a[k * 4 + row]! * b[column * 4 + k]!
    }
  }
  return result
}

/** Column-major matrix. Euler angles are degrees, applied X then Y then Z. */
export function modelTransform(translation: ModelVector = [0, 0, 0], rotation: ModelVector = [0, 0, 0]): ModelMatrix {
  const [x, y, z] = rotation.map(radians)
  const rx = [1, 0, 0, 0, 0, Math.cos(x!), Math.sin(x!), 0, 0, -Math.sin(x!), Math.cos(x!), 0, 0, 0, 0, 1]
  const ry = [Math.cos(y!), 0, -Math.sin(y!), 0, 0, 1, 0, 0, Math.sin(y!), 0, Math.cos(y!), 0, 0, 0, 0, 1]
  const rz = [Math.cos(z!), Math.sin(z!), 0, 0, -Math.sin(z!), Math.cos(z!), 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
  const move = identity()
  move[12] = translation[0]; move[13] = translation[1]; move[14] = translation[2]
  return multiplyModelMatrices(move, multiplyModelMatrices(rz, multiplyModelMatrices(ry, rx)))
}

export function transformModelPoint(point: ModelVector, matrix: ModelMatrix): ModelVector {
  return [0, 1, 2].map(i => matrix[i]! * point[0] + matrix[4 + i]! * point[1] + matrix[8 + i]! * point[2] + matrix[12 + i]!) as ModelVector
}

export function parseBinaryModelStl(buffer: ArrayBuffer): Float32Array {
  if (buffer.byteLength < 84 || buffer.byteLength > 32 * 1024 * 1024)
    throw new Error('The binary STL is empty, truncated or larger than 32 MB.')
  const data = new DataView(buffer)
  const count = data.getUint32(80, true)
  if (!count || count > 500000 || buffer.byteLength !== 84 + count * 50)
    throw new Error('This viewer requires a valid binary STL file.')
  const output = new Float32Array(count * 9)
  for (let face = 0; face < count; face++) {
    for (let value = 0; value < 9; value++) {
      const coordinate = data.getFloat32(84 + face * 50 + 12 + value * 4, true)
      if (!Number.isFinite(coordinate))
        throw new Error('The STL contains an invalid coordinate.')
      output[face * 9 + value] = coordinate
    }
  }
  return output
}

export function createModelGeometry(geometry: Exclude<ModelGeometry, { kind: 'stl' }>): Float32Array {
  // Indexed geometry is authored in the scene, so it needs no URL, fetch or
  // retained STL resource. This keeps interactive procedural models native.
  if (geometry.kind === 'mesh') {
    if (!Array.isArray(geometry.vertices) || geometry.vertices.length < 3 || geometry.vertices.length > 500000
      || !Array.isArray(geometry.triangles) || !geometry.triangles.length || geometry.triangles.length > 500000)
      throw new Error('An inline mesh requires 3-500000 vertices and 1-500000 triangles.')
    for (const vertex of geometry.vertices) {
      if (!Array.isArray(vertex) || vertex.length !== 3 || ![0, 1, 2].every(axis => Number.isFinite(vertex[axis]) && Number.isFinite(Math.fround(vertex[axis]!))))
        throw new Error('An inline mesh contains an invalid coordinate.')
    }
    const output = new Float32Array(geometry.triangles.length * 9)
    for (let face = 0; face < geometry.triangles.length; face++) {
      const indices = geometry.triangles[face]!
      if (!Array.isArray(indices) || indices.length !== 3 || ![0, 1, 2].every(corner => Number.isInteger(indices[corner]) && indices[corner]! >= 0 && indices[corner]! < geometry.vertices.length)
        || new Set(indices).size !== 3)
        throw new Error('An inline mesh contains an invalid triangle index.')
      for (let corner = 0; corner < 3; corner++)
        output.set(geometry.vertices[indices[corner]!]!, face * 9 + corner * 3)
    }
    return output
  }
  const positions: number[] = []
  const triangle = (a: ModelVector, b: ModelVector, c: ModelVector) => positions.push(...a, ...b, ...c)
  const quad = (a: ModelVector, b: ModelVector, c: ModelVector, d: ModelVector) => { triangle(a, b, c); triangle(a, c, d) }
  function squareSides(outer: number, inner: number, length: number): void {
    const ring = (radius: number, z: number): ModelVector[] => [[-radius, -radius, z], [radius, -radius, z], [radius, radius, z], [-radius, radius, z]]
    const low = ring(outer / 2, 0); const high = ring(outer / 2, length)
    const insideLow = ring(inner / 2, 0); const insideHigh = ring(inner / 2, length)
    for (let i = 0; i < 4; i++) {
      const next = (i + 1) % 4
      quad(low[i]!, low[next]!, high[next]!, high[i]!)
      quad(insideLow[next]!, insideLow[i]!, insideHigh[i]!, insideHigh[next]!)
      quad(high[i]!, high[next]!, insideHigh[next]!, insideHigh[i]!)
      quad(low[next]!, low[i]!, insideLow[i]!, insideLow[next]!)
    }
  }
  if (geometry.kind === 'box') {
    if (!geometry.size.every(v => Number.isFinite(v) && v > 0))
      throw new Error('Box dimensions must be positive.')
    const [x, y, z] = geometry.size.map(v => v / 2) as ModelVector
    const a: ModelVector = [-x, -y, -z]; const b: ModelVector = [x, -y, -z]; const c: ModelVector = [x, y, -z]; const d: ModelVector = [-x, y, -z]
    const e: ModelVector = [-x, -y, z]; const f: ModelVector = [x, -y, z]; const g: ModelVector = [x, y, z]; const h: ModelVector = [-x, y, z]
    quad(a, d, c, b); quad(e, f, g, h); quad(a, b, f, e); quad(b, c, g, f); quad(c, d, h, g); quad(d, a, e, h)
  }
  else if (geometry.kind === 'tube') {
    if (![geometry.outer, geometry.inner, geometry.length].every(v => Number.isFinite(v) && v > 0) || geometry.inner >= geometry.outer)
      throw new Error('Tube dimensions are incompatible.')
    squareSides(geometry.outer, geometry.inner, geometry.length)
  }
  else {
    const { radius, length, innerRadius = 0, segments = 48 } = geometry
    if (![radius, length, innerRadius, segments].every(Number.isFinite) || radius <= 0 || length <= 0 || innerRadius < 0 || innerRadius >= radius || !Number.isInteger(segments) || segments < 8 || segments > 192)
      throw new Error('Cylinder dimensions are incompatible.')
    const point = (r: number, angle: number, z: number): ModelVector => [r * Math.cos(angle), r * Math.sin(angle), z]
    for (let i = 0; i < segments; i++) {
      const a = i * Math.PI * 2 / segments; const b = (i + 1) * Math.PI * 2 / segments
      const lowA = point(radius, a, -length / 2); const lowB = point(radius, b, -length / 2)
      const highA = point(radius, a, length / 2); const highB = point(radius, b, length / 2)
      quad(lowA, lowB, highB, highA)
      if (innerRadius) {
        const ilA = point(innerRadius, a, -length / 2); const ilB = point(innerRadius, b, -length / 2)
        const ihA = point(innerRadius, a, length / 2); const ihB = point(innerRadius, b, length / 2)
        quad(ilB, ilA, ihA, ihB); quad(highA, highB, ihB, ihA); quad(lowB, lowA, ilA, ilB)
      }
      else { triangle(highA, highB, [0, 0, length / 2]); triangle(lowB, lowA, [0, 0, -length / 2]) }
    }
  }
  return new Float32Array(positions)
}

function cameraMatrix(yaw: number, pitch: number, distance: number, target: ModelVector): ModelMatrix {
  const offset: ModelVector = [Math.cos(pitch) * Math.cos(yaw), Math.cos(pitch) * Math.sin(yaw), Math.sin(pitch)]
  const eye = target.map((n, i) => n + offset[i]! * distance) as ModelVector
  const z = unit(sub(eye, target)); const x = unit(cross([0, 0, 1], z)); const y = cross(z, x)
  return [x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, eye), -dot(y, eye), -dot(z, eye), 1]
}

/** Owns its GPU buffer, observer and listeners. Caller disposes on component teardown. */
export function createModelViewer(canvas: HTMLCanvasElement, options: ModelViewerOptions = {}): ModelViewerController {
  const gl = canvas.getContext('webgl', { antialias: true, alpha: true, preserveDrawingBuffer: false })
  if (!gl)
    throw new Error('Interactive 3D is unavailable in this browser. The drawing and downloads are still available.')
  const vertexSource = 'attribute vec3 aPosition; attribute vec3 aNormal; attribute vec3 aColor; uniform mat4 uView; uniform mat4 uProjection; varying vec3 vNormal; varying vec3 vColor; void main(){vNormal=aNormal;vColor=aColor;gl_Position=uProjection*uView*vec4(aPosition,1.0);}'
  const fragmentSource = 'precision mediump float; varying vec3 vNormal; varying vec3 vColor; void main(){vec3 n=normalize(vNormal);float l=0.52+0.32*abs(dot(n,normalize(vec3(-0.4,-0.6,1.0))))+0.16*abs(dot(n,normalize(vec3(0.8,0.4,0.5))));gl_FragColor=vec4(vColor*l,1.0);}'
  const ownedShaders: WebGLShader[] = []
  function shader(kind: number, source: string): WebGLShader {
    const result = gl!.createShader(kind)
    if (!result)
      throw new Error('The browser could not allocate the 3D shader.')
    ownedShaders.push(result)
    gl!.shaderSource(result, source); gl!.compileShader(result)
    if (!gl!.getShaderParameter(result, gl!.COMPILE_STATUS))
      throw new Error('The browser could not compile the 3D shader.')
    return result
  }
  const program = gl.createProgram(); const buffer = gl.createBuffer()
  if (!program || !buffer) {
    if (program) gl.deleteProgram(program)
    if (buffer) gl.deleteBuffer(buffer)
    throw new Error('The browser could not allocate the 3D scene.')
  }
  try {
    gl.attachShader(program, shader(gl.VERTEX_SHADER, vertexSource)); gl.attachShader(program, shader(gl.FRAGMENT_SHADER, fragmentSource)); gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS))
      throw new Error('The browser could not prepare the 3D scene.')
  }
  catch (error) {
    ownedShaders.forEach(s => gl.deleteShader(s)); gl.deleteProgram(program); gl.deleteBuffer(buffer)
    throw error
  }
  const position = gl.getAttribLocation(program, 'aPosition'); const normal = gl.getAttribLocation(program, 'aNormal'); const color = gl.getAttribLocation(program, 'aColor')
  const viewUniform = gl.getUniformLocation(program, 'uView'); const projectionUniform = gl.getUniformLocation(program, 'uProjection')
  const resources = new Map<string, Promise<Float32Array>>()
  const abort = new AbortController()
  let disposed = false; let lost = false; let epoch = 0; let pendingFrame = 0; let vertices = 0
  let center: ModelVector = [0, 0, 0]; let radius = 1; let yaw = radians(-135); let pitch = radians(24); let zoom = 1
  const pointers = new Map<number, { x: number, y: number }>()
  const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n))
  function render(): void {
    pendingFrame = 0
    if (disposed || lost || !vertices)
      return
    const ratio = Math.min(globalThis.devicePixelRatio || 1, 2)
    const width = Math.max(1, Math.round(canvas.clientWidth * ratio)); const height = Math.max(1, Math.round(canvas.clientHeight * ratio))
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height }
    gl!.viewport(0, 0, width, height)
    gl!.clearColor(...(options.background || [0, 0, 0]), 0); gl!.clear(gl!.COLOR_BUFFER_BIT | gl!.DEPTH_BUFFER_BIT); gl!.enable(gl!.DEPTH_TEST)
    gl!.useProgram(program); gl!.bindBuffer(gl!.ARRAY_BUFFER, buffer)
    for (const [attribute, offset] of [[position, 0], [normal, 12], [color, 24]]) { gl!.enableVertexAttribArray(attribute!); gl!.vertexAttribPointer(attribute!, 3, gl!.FLOAT, false, 36, offset!) }
    const aspect = width / height; const fov = Math.PI / 4; const distance = radius * 1.2 / Math.sin(Math.atan(Math.tan(fov / 2) * Math.min(aspect, 1))) * zoom
    const near = Math.max(radius / 100, 0.01); const far = Math.max(radius * 80, distance + radius * 4); const f = 1 / Math.tan(fov / 2)
    const projection = [f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) / (near - far), -1, 0, 0, 2 * far * near / (near - far), 0]
    gl!.uniformMatrix4fv(viewUniform, false, new Float32Array(cameraMatrix(yaw, pitch, distance, center)))
    gl!.uniformMatrix4fv(projectionUniform, false, new Float32Array(projection))
    gl!.drawArrays(gl!.TRIANGLES, 0, vertices)
  }
  function schedule(): void { if (!disposed && !pendingFrame) pendingFrame = requestAnimationFrame(render) }
  function setZoom(factor: number): void { if (Number.isFinite(factor) && factor > 0) { zoom = clamp(zoom * factor, 0.3, 3); schedule() } }
  function preset(name: 'home' | 'front' | 'side' | 'top'): void {
    const values = { home: [-135, 24], front: [180, 0], side: [-90, 0], top: [-90, 89.5] }[name]
    yaw = radians(values[0]!); pitch = radians(values[1]!); zoom = 1; schedule()
  }
  const listeners: (() => void)[] = []
  function listen<K extends keyof HTMLElementEventMap>(name: K, listener: (event: HTMLElementEventMap[K]) => void, config?: AddEventListenerOptions): void {
    canvas.addEventListener(name, listener, config); listeners.push(() => canvas.removeEventListener(name, listener, config))
  }
  listen('pointerdown', event => {
    if (event.button !== 0 && event.pointerType === 'mouse') return
    canvas.focus({ preventScroll: true }); canvas.setPointerCapture(event.pointerId); pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
  })
  listen('pointermove', event => {
    const last = pointers.get(event.pointerId)
    if (!last) return
    const other = [...pointers.entries()].find(([id]) => id !== event.pointerId)?.[1]
    if (other) {
      const before = Math.hypot(last.x - other.x, last.y - other.y); const after = Math.hypot(event.clientX - other.x, event.clientY - other.y)
      if (before > 1 && after > 1) setZoom(before / after)
    }
    else { yaw -= (event.clientX - last.x) * 0.008; pitch = clamp(pitch + (event.clientY - last.y) * 0.008, radians(-80), radians(89.5)); schedule() }
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
  })
  const release = (event: PointerEvent) => { pointers.delete(event.pointerId) }
  listen('pointerup', release); listen('pointercancel', release); listen('lostpointercapture', release)
  listen('wheel', event => { event.preventDefault(); setZoom(Math.exp(clamp(event.deltaY, -120, 120) * 0.002)) }, { passive: false })
  listen('keydown', event => {
    if (event.key === 'Home') preset('home')
    else if (event.key === '+' || event.key === '=') setZoom(0.85)
    else if (event.key === '-') setZoom(1.15)
    else if (event.key.startsWith('Arrow')) { yaw += event.key === 'ArrowLeft' ? -0.12 : event.key === 'ArrowRight' ? 0.12 : 0; pitch = clamp(pitch + (event.key === 'ArrowUp' ? 0.12 : event.key === 'ArrowDown' ? -0.12 : 0), radians(-80), radians(89.5)); schedule() }
    else return
    event.preventDefault()
  })
  const contextLost = (event: Event) => { event.preventDefault(); lost = true; options.onStatus?.('error', 'The 3D connection was interrupted. Reload this page to restore it. Your downloads remain available.') }
  canvas.addEventListener('webglcontextlost', contextLost)
  listeners.push(() => canvas.removeEventListener('webglcontextlost', contextLost))
  const resize = new ResizeObserver(schedule); resize.observe(canvas)
  async function geometry(g: ModelGeometry): Promise<Float32Array> {
    if (g.kind !== 'stl') return createModelGeometry(g)
    const key = JSON.stringify(g)
    if (!resources.has(key)) {
      const work = (async () => {
        const url = new URL(g.src, globalThis.location.href)
        if (url.origin !== globalThis.location.origin) throw new Error('Model files must use the same origin as the viewer.')
        const response = await fetch(url, { signal: abort.signal })
        if (!response.ok) throw new Error('A model part could not be loaded. Try reloading this page.')
        if (Number(response.headers.get('content-length') || 0) > 32 * 1024 * 1024) throw new Error('The model part exceeds 32 MB.')
        return parseBinaryModelStl(await response.arrayBuffer())
      })()
      resources.set(key, work)
      work.catch(() => resources.delete(key))
    }
    return resources.get(key)!
  }
  async function setScene(scene: ModelScene): Promise<void> {
    if (disposed || lost) return
    const ticket = ++epoch
    options.onStatus?.('loading')
    try {
      if (!scene || !Array.isArray(scene.nodes) || !scene.nodes.length || scene.nodes.length > 500) throw new Error('The model scene is empty or exceeds 500 parts.')
      const meshes = await Promise.all(scene.nodes.map(node => geometry(node.geometry)))
      if (disposed || lost || ticket !== epoch) return
      const count = meshes.reduce((total, mesh) => total + mesh.length / 3, 0)
      if (count > 1500000) throw new Error('This model exceeds the viewer detail limit.')
      const data = new Float32Array(count * 9); let offset = 0
      const min: ModelVector = [Infinity, Infinity, Infinity]; const max: ModelVector = [-Infinity, -Infinity, -Infinity]
      for (let nodeIndex = 0; nodeIndex < scene.nodes.length; nodeIndex++) {
        const node = scene.nodes[nodeIndex]!; const mesh = meshes[nodeIndex]!; const matrix = node.transform || identity()
        if (matrix.length !== 16 || !matrix.every(Number.isFinite) || !/^#[\da-f]{6}$/i.test(node.color || '#88948e')) throw new Error('A model transform or color is invalid.')
        const hex = node.color || '#88948e'; const rgb = [1, 3, 5].map(i => Number.parseInt(hex.slice(i, i + 2), 16) / 255)
        for (let i = 0; i < mesh.length; i += 9) {
          const points = [0, 3, 6].map(j => transformModelPoint([mesh[i + j]!, mesh[i + j + 1]!, mesh[i + j + 2]!], matrix))
          const normal = unit(cross(sub(points[1]!, points[0]!), sub(points[2]!, points[0]!)))
          for (const point of points) {
            if (!point.every(Number.isFinite)) throw new Error('A transformed model coordinate is invalid.')
            for (let axis = 0; axis < 3; axis++) { min[axis] = Math.min(min[axis]!, point[axis]!); max[axis] = Math.max(max[axis]!, point[axis]!) }
            data.set([...point, ...normal, ...rgb], offset); offset += 9
          }
        }
      }
      center = min.map((value, i) => (value + max[i]!) / 2) as ModelVector
      radius = Math.max(1, Math.hypot(...max.map((value, i) => value - min[i]!)) / 2)
      gl!.bindBuffer(gl!.ARRAY_BUFFER, buffer); gl!.bufferData(gl!.ARRAY_BUFFER, data, gl!.DYNAMIC_DRAW); vertices = count
      canvas.dataset.modelNodes = String(scene.nodes.length); canvas.dataset.modelVertices = String(vertices)
      schedule(); options.onStatus?.('ready')
    }
    catch (error) { if (!disposed && ticket === epoch) options.onStatus?.('error', error instanceof Error ? error.message : 'The model could not be loaded.') }
  }
  function dispose(): void {
    if (disposed) return
    disposed = true; epoch++; abort.abort(); resize.disconnect(); listeners.forEach(remove => remove()); pointers.clear(); resources.clear()
    if (pendingFrame) cancelAnimationFrame(pendingFrame)
    gl!.deleteBuffer(buffer); gl!.deleteProgram(program); ownedShaders.forEach(s => gl!.deleteShader(s))
  }
  return { setScene, view: preset, zoom: setZoom, dispose }
}
