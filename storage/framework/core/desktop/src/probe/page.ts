/**
 * The probe page's script (stacksjs/stacks#877).
 *
 * Runs inside a Craft window, or in an ordinary browser for comparison, and
 * posts raw observations to the runner that served it. It is a measurement
 * harness, not stx: it is bundled for the browser by the runner and inlined into
 * a standalone HTML page, so it talks to the DOM directly and pulls in nothing.
 *
 * Order matters. The static probes run first, then frame pacing (idle, then
 * under load), then an optional window for real input, then Craft's native
 * fullscreen. Nothing here synthesises input: every latency sample comes from a
 * trusted event, so an unattended run reports no samples rather than fake ones.
 */

import type { AudioSnapshot, InputSample, ProbePageConfig, ProbePagePayload, RequestOutcome } from './payload'

interface GpuAdapterInfoLike { vendor?: string, architecture?: string, description?: string }
interface GpuAdapterLike {
  info?: GpuAdapterInfoLike
  features?: { size: number }
  limits?: { maxTextureDimension2D?: number }
  requestDevice: () => Promise<{ destroy?: () => void }>
}
interface GpuLike { requestAdapter: () => Promise<GpuAdapterLike | null> }
interface CraftBridgeLike { window?: { setFullscreen?: (fullscreen: boolean) => Promise<unknown> | unknown } }
interface AudioContextLike {
  state: string
  baseLatency?: number
  outputLatency?: number
  sampleRate: number
  resume: () => Promise<void>
  close: () => Promise<void>
}

const configElement = document.getElementById('probe-config')
const config = JSON.parse(configElement?.textContent || '{}') as ProbePageConfig
const statusElement = document.getElementById('status')!
const panel = document.getElementById('interactive')!
const canvas = document.getElementById('scene') as HTMLCanvasElement

const errors: string[] = []

function say(message: string): void {
  statusElement.textContent = message
  void fetch('/progress', { method: 'POST', body: message }).catch(() => {})
}

function errorText(error: unknown): string {
  if (error instanceof Error)
    return `${error.name}: ${error.message}`
  return String(error)
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function nextFrame(): Promise<number> {
  return new Promise(resolve => requestAnimationFrame(resolve))
}

function withTimeout<T>(work: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([work, sleep(ms).then(() => fallback)])
}

function timerResolution(): number {
  let smallest = Number.POSITIVE_INFINITY
  let last = performance.now()
  const deadline = last + 50
  while (last < deadline) {
    const now = performance.now()
    const step = now - last
    if (step > 0 && step < smallest)
      smallest = step
    last = now
  }
  return Math.round(smallest * 1000) / 1000
}

function eventTimeStampComparable(): boolean {
  // Some engines once stamped events with epoch milliseconds. Comparing those
  // with performance.now() would produce latencies of fifty years.
  const event = new Event('probe')
  return Math.abs(event.timeStamp - performance.now()) < 10_000
}

// ── WebGL2 ────────────────────────────────────────────────────────────────

function probeWebgl2(): ProbePagePayload['webgl2'] {
  try {
    const gl = document.createElement('canvas').getContext('webgl2')
    if (!gl)
      return { ok: false, error: 'getContext("webgl2") returned null' }
    const debug = gl.getExtension('WEBGL_debug_renderer_info')
    return {
      ok: true,
      version: String(gl.getParameter(gl.VERSION)),
      shadingLanguageVersion: String(gl.getParameter(gl.SHADING_LANGUAGE_VERSION)),
      vendor: String(gl.getParameter(gl.VENDOR)),
      renderer: String(gl.getParameter(gl.RENDERER)),
      unmaskedVendor: debug ? String(gl.getParameter(debug.UNMASKED_VENDOR_WEBGL)) : undefined,
      unmaskedRenderer: debug ? String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)) : undefined,
      maxTextureSize: Number(gl.getParameter(gl.MAX_TEXTURE_SIZE)),
      maxSamples: Number(gl.getParameter(gl.MAX_SAMPLES)),
      extensions: gl.getSupportedExtensions()?.length ?? 0,
    }
  }
  catch (error) {
    return { ok: false, error: errorText(error) }
  }
}

// ── WebGPU ────────────────────────────────────────────────────────────────

async function probeWebgpu(): Promise<ProbePagePayload['webgpu']> {
  const gpu = (navigator as unknown as { gpu?: GpuLike }).gpu
  if (!gpu)
    return { present: false, adapter: false, device: false }
  try {
    const adapter = await withTimeout(gpu.requestAdapter(), 5000, null)
    if (!adapter)
      return { present: true, adapter: false, device: false, error: 'requestAdapter() resolved null or timed out' }
    const info = adapter.info ?? {}
    let device = false
    let error: string | undefined
    try {
      const created = await withTimeout(adapter.requestDevice(), 5000, null)
      device = created !== null
      created?.destroy?.()
      if (!device)
        error = 'requestDevice() timed out'
    }
    catch (deviceError) {
      error = errorText(deviceError)
    }
    return {
      present: true,
      adapter: true,
      device,
      error,
      vendor: info.vendor || undefined,
      architecture: info.architecture || undefined,
      description: info.description || undefined,
      maxTextureDimension2D: adapter.limits?.maxTextureDimension2D,
      features: adapter.features?.size,
    }
  }
  catch (error) {
    return { present: true, adapter: false, device: false, error: errorText(error) }
  }
}

// ── The load scene ────────────────────────────────────────────────────────

const VERTEX = `#version 300 es
layout(location = 0) in vec3 position;
layout(location = 1) in vec3 normal;
layout(location = 2) in vec4 offset;
uniform float time;
uniform float aspect;
out vec3 shade;
mat3 rotation(float a, float b) {
  float ca = cos(a), sa = sin(a), cb = cos(b), sb = sin(b);
  return mat3(cb, 0.0, -sb, sa * sb, ca, sa * cb, ca * sb, -sa, ca * cb);
}
void main() {
  mat3 r = rotation(time + offset.w, time * 0.7 + offset.w * 2.0);
  vec3 p = r * position * 0.012 + offset.xyz;
  vec3 n = r * normal;
  shade = vec3(0.35, 0.55, 0.95) * (0.35 + 0.65 * max(dot(n, normalize(vec3(0.4, 0.8, 0.6))), 0.0));
  gl_Position = vec4(p.x / aspect, p.y, p.z * 0.5, 1.0);
}`

const FRAGMENT = `#version 300 es
precision mediump float;
in vec3 shade;
out vec4 color;
void main() { color = vec4(shade, 1.0); }`

function cubeGeometry(): Float32Array {
  // 6 faces x 2 triangles x 3 vertices, each vertex position + normal.
  const faces: Array<[number[], number[], number[]]> = [
    [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
    [[-1, 0, 0], [0, 0, 1], [0, 1, 0]],
    [[0, 1, 0], [0, 0, 1], [1, 0, 0]],
    [[0, -1, 0], [1, 0, 0], [0, 0, 1]],
    [[0, 0, 1], [1, 0, 0], [0, 1, 0]],
    [[0, 0, -1], [0, 1, 0], [1, 0, 0]],
  ]
  const out: number[] = []
  for (const [n, u, v] of faces) {
    const corner = (su: number, sv: number) => [0, 1, 2].map(i => n[i]! + su * u[i]! + sv * v[i]!)
    const quad = [corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, -1), corner(1, 1), corner(-1, 1)]
    for (const p of quad)
      out.push(...p, ...n)
  }
  return new Float32Array(out)
}

interface Scene { draw: (time: number) => void, triangles: number }

function webglScene(instances: number): Scene | null {
  const gl = canvas.getContext('webgl2', { antialias: true, powerPreference: 'high-performance' })
  if (!gl)
    return null

  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type)!
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
      throw new Error(gl.getShaderInfoLog(shader) || 'shader compile failed')
    return shader
  }
  const program = gl.createProgram()!
  gl.attachShader(program, compile(gl.VERTEX_SHADER, VERTEX))
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAGMENT))
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS))
    throw new Error(gl.getProgramInfoLog(program) || 'program link failed')

  const vao = gl.createVertexArray()
  gl.bindVertexArray(vao)

  const geometry = cubeGeometry()
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
  gl.bufferData(gl.ARRAY_BUFFER, geometry, gl.STATIC_DRAW)
  gl.enableVertexAttribArray(0)
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0)
  gl.enableVertexAttribArray(1)
  gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12)

  const offsets = new Float32Array(instances * 4)
  for (let i = 0; i < instances; i++) {
    offsets[i * 4] = Math.random() * 2 - 1
    offsets[i * 4 + 1] = Math.random() * 2 - 1
    offsets[i * 4 + 2] = Math.random() * 2 - 1
    offsets[i * 4 + 3] = Math.random() * Math.PI * 2
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
  gl.bufferData(gl.ARRAY_BUFFER, offsets, gl.STATIC_DRAW)
  gl.enableVertexAttribArray(2)
  gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 16, 0)
  gl.vertexAttribDivisor(2, 1)

  gl.useProgram(program)
  gl.enable(gl.DEPTH_TEST)
  const timeLocation = gl.getUniformLocation(program, 'time')
  const aspectLocation = gl.getUniformLocation(program, 'aspect')
  const vertices = geometry.length / 6

  return {
    triangles: (vertices / 3) * instances,
    draw(time: number) {
      const width = Math.floor(canvas.clientWidth * devicePixelRatio)
      const height = Math.floor(canvas.clientHeight * devicePixelRatio)
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width
        canvas.height = height
      }
      gl.viewport(0, 0, width, height)
      gl.clearColor(0.04, 0.05, 0.08, 1)
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
      gl.uniform1f(timeLocation, time / 1000)
      gl.uniform1f(aspectLocation, width / Math.max(1, height))
      gl.drawArraysInstanced(gl.TRIANGLES, 0, vertices, instances)
    },
  }
}

function canvas2dScene(): Scene {
  const context = canvas.getContext('2d')!
  return {
    triangles: 0,
    draw(time: number) {
      canvas.width = canvas.clientWidth
      canvas.height = canvas.clientHeight
      context.fillStyle = '#0a0d14'
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.fillStyle = '#5b8cf2'
      for (let i = 0; i < 2000; i++)
        context.fillRect((i * 37 + time / 4) % canvas.width, (i * 53) % canvas.height, 6, 6)
    },
  }
}

function busyWait(ms: number): void {
  const until = performance.now() + ms
  while (performance.now() < until) {
    // Standing in for game logic: the frame has this much less time to present.
  }
}

async function sampleFrames(durationMs: number, onFrame?: (time: number) => void): Promise<{ timestamps: number[], hidden: boolean }> {
  const timestamps: number[] = []
  let hidden = document.visibilityState !== 'visible'
  const onVisibility = () => {
    if (document.visibilityState !== 'visible')
      hidden = true
  }
  document.addEventListener('visibilitychange', onVisibility)
  await nextFrame()
  const start = performance.now()
  await new Promise<void>((resolve) => {
    const tick = (time: number) => {
      timestamps.push(time)
      onFrame?.(time)
      if (performance.now() - start < durationMs)
        requestAnimationFrame(tick)
      else
        resolve()
    }
    requestAnimationFrame(tick)
  })
  document.removeEventListener('visibilitychange', onVisibility)
  return { timestamps, hidden }
}

// ── Audio ─────────────────────────────────────────────────────────────────

let audioContext: AudioContextLike | null = null

function snapshot(context: AudioContextLike): AudioSnapshot {
  return {
    state: context.state,
    baseLatency: typeof context.baseLatency === 'number' ? context.baseLatency : null,
    outputLatency: typeof context.outputLatency === 'number' ? context.outputLatency : null,
    sampleRate: context.sampleRate,
  }
}

async function probeAudio(): Promise<ProbePagePayload['audio']> {
  const Constructor = (window as unknown as { AudioContext?: new (options?: { latencyHint?: string }) => AudioContextLike }).AudioContext
  if (!Constructor)
    return { present: false }
  try {
    audioContext = new Constructor({ latencyHint: 'interactive' })
    const initial = snapshot(audioContext)
    await withTimeout(audioContext.resume().catch(() => {}), 1500, undefined)
    // outputLatency is only meaningful once the device is actually running.
    await sleep(300)
    return { present: true, initial, afterUngesturedResume: snapshot(audioContext) }
  }
  catch (error) {
    return { present: true, error: errorText(error) }
  }
}

// ── Fullscreen and pointer lock ───────────────────────────────────────────

function requestFullscreen(target: HTMLElement): Promise<RequestOutcome> {
  const standard = (target as { requestFullscreen?: () => Promise<void> }).requestFullscreen
  const legacy = (target as unknown as { webkitRequestFullscreen?: () => void }).webkitRequestFullscreen
  if (!standard && !legacy)
    return Promise.resolve({ outcome: 'no-api' })

  return new Promise((resolve) => {
    let settled = false
    const finish = (outcome: RequestOutcome) => {
      if (settled)
        return
      settled = true
      resolve(outcome)
    }
    const entered = () => finish({ outcome: 'entered', detail: 'fullscreenchange' })
    const failed = () => finish({ outcome: 'rejected', detail: 'fullscreenerror' })
    document.addEventListener('fullscreenchange', entered, { once: true })
    document.addEventListener('webkitfullscreenchange', entered, { once: true })
    document.addEventListener('fullscreenerror', failed, { once: true })
    document.addEventListener('webkitfullscreenerror', failed, { once: true })
    try {
      if (standard) {
        standard.call(target).then(
          () => finish({ outcome: 'entered', detail: 'promise resolved' }),
          (error: unknown) => finish({ outcome: 'rejected', detail: errorText(error) }),
        )
      }
      else {
        legacy!.call(target)
      }
    }
    catch (error) {
      finish({ outcome: 'rejected', detail: errorText(error) })
    }
    setTimeout(() => finish({ outcome: 'timeout' }), 3000)
  })
}

async function exitFullscreen(): Promise<void> {
  const exit = (document as { exitFullscreen?: () => Promise<void> }).exitFullscreen
  if (document.fullscreenElement && exit)
    await exit.call(document).catch(() => {})
}

function requestPointerLock(target: HTMLElement): Promise<RequestOutcome> {
  if (typeof target.requestPointerLock !== 'function')
    return Promise.resolve({ outcome: 'no-api' })

  return new Promise((resolve) => {
    let settled = false
    const finish = (outcome: RequestOutcome) => {
      if (settled)
        return
      settled = true
      document.removeEventListener('pointerlockchange', changed)
      document.removeEventListener('pointerlockerror', failed)
      resolve(outcome)
    }
    const changed = () => {
      if (document.pointerLockElement === target)
        finish({ outcome: 'entered', detail: 'pointerlockchange' })
    }
    const failed = () => finish({ outcome: 'rejected', detail: 'pointerlockerror' })
    document.addEventListener('pointerlockchange', changed)
    document.addEventListener('pointerlockerror', failed)
    try {
      // Chromium returns a promise; WebKit returns undefined and reports
      // through the events above.
      const result = target.requestPointerLock() as unknown as Promise<void> | undefined
      result?.then?.(() => changed(), (error: unknown) => finish({ outcome: 'rejected', detail: errorText(error) }))
    }
    catch (error) {
      finish({ outcome: 'rejected', detail: errorText(error) })
    }
    setTimeout(() => finish({ outcome: 'timeout' }), 3000)
  })
}

async function nativeFullscreen(): Promise<ProbePagePayload['fullscreen']['nativeBridge']> {
  const bridge = (window as unknown as { craft?: CraftBridgeLike }).craft
  const set = bridge?.window?.setFullscreen
  if (typeof set !== 'function')
    return { outcome: 'no-api' }

  const size = () => `${innerWidth}x${innerHeight}`
  const sizeBefore = size()
  try {
    await withTimeout(Promise.resolve(set.call(bridge!.window, true)), 3000, undefined)
    // The macOS fullscreen transition animates; give it time to land.
    await sleep(2000)
    const sizeAfter = size()
    const entered = sizeAfter !== sizeBefore && innerWidth >= screen.width - 2
    await withTimeout(Promise.resolve(set.call(bridge!.window, false)), 3000, undefined)
    await sleep(1500)
    return { outcome: entered ? 'entered' : 'rejected', detail: entered ? 'viewport grew to the screen' : 'viewport did not change', sizeBefore, sizeAfter }
  }
  catch (error) {
    return { outcome: 'rejected', detail: errorText(error), sizeBefore }
  }
}

// ── Input latency ─────────────────────────────────────────────────────────

const samples: ProbePagePayload['input'] = {
  pointerdown: [],
  pointermove: [],
  keydown: [],
  eventTimingSupported: typeof PerformanceObserver !== 'undefined'
    && (PerformanceObserver.supportedEntryTypes ?? []).includes('event'),
  eventTimingDurations: [],
}

let sawRealInput = false
let movePending = false

function timeEvent(event: Event, into: InputSample[]): void {
  if (!event.isTrusted)
    return
  sawRealInput = true
  const stamp = event.timeStamp
  requestAnimationFrame(() => {
    const toFrameMs = performance.now() - stamp
    const channel = new MessageChannel()
    channel.port1.onmessage = () => {
      into.push({ toFrameMs, toPostFrameMs: performance.now() - stamp })
      movePending = false
    }
    channel.port2.postMessage(0)
  })
}

function listenForInput(): () => void {
  const onDown = (event: Event) => timeEvent(event, samples.pointerdown)
  const onKey = (event: Event) => timeEvent(event, samples.keydown)
  const onMove = (event: Event) => {
    // One move in flight at a time, so a fast drag is not one sample per pixel.
    if (movePending || !event.isTrusted)
      return
    movePending = true
    timeEvent(event, samples.pointermove)
  }
  addEventListener('pointerdown', onDown, true)
  addEventListener('keydown', onKey, true)
  addEventListener('pointermove', onMove, true)

  let observer: PerformanceObserver | null = null
  if (samples.eventTimingSupported) {
    observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries())
        samples.eventTimingDurations.push(entry.duration)
    })
    try {
      observer.observe({ type: 'event', buffered: true, durationThreshold: 16 } as PerformanceObserverInit)
    }
    catch {
      observer = null
    }
  }

  return () => {
    removeEventListener('pointerdown', onDown, true)
    removeEventListener('keydown', onKey, true)
    removeEventListener('pointermove', onMove, true)
    observer?.disconnect()
  }
}

// ── The interactive window ────────────────────────────────────────────────

async function interactivePhase(payload: ProbePagePayload): Promise<void> {
  if (config.interactionWindowMs <= 0) {
    payload.interaction.skipped = true
    return
  }

  panel.hidden = false
  const fullscreenButton = document.getElementById('fullscreen-button')!
  const lockButton = document.getElementById('lock-button')!
  const doneButton = document.getElementById('done-button')!
  const countdown = document.getElementById('countdown')!

  let fullscreenDone = false
  let lockDone = false
  let finish: () => void = () => {}
  const finished = new Promise<void>(resolve => (finish = resolve))
  const maybeFinish = () => {
    if (fullscreenDone && lockDone && samples.keydown.length >= 5)
      finish()
  }

  fullscreenButton.addEventListener('click', async (event) => {
    if (!event.isTrusted || fullscreenDone)
      return
    fullscreenDone = true
    fullscreenButton.setAttribute('disabled', '')
    // Both requests ride the same user activation.
    const resume = audioContext?.resume().catch(() => {})
    payload.fullscreen.gestured = await requestFullscreen(document.documentElement)
    await resume
    await sleep(300)
    if (audioContext)
      payload.audio.afterGesturedResume = snapshot(audioContext)
    await sleep(700)
    await exitFullscreen()
    maybeFinish()
  })

  lockButton.addEventListener('click', async (event) => {
    if (!event.isTrusted || lockDone)
      return
    lockDone = true
    lockButton.setAttribute('disabled', '')
    payload.pointerLock.gestured = await requestPointerLock(canvas)
    await sleep(500)
    if (document.pointerLockElement)
      document.exitPointerLock()
    maybeFinish()
  })

  addEventListener('keydown', () => setTimeout(maybeFinish, 100))
  doneButton.addEventListener('click', event => event.isTrusted && finish())

  const deadline = performance.now() + config.interactionWindowMs
  const timer = setInterval(() => {
    const left = Math.max(0, Math.ceil((deadline - performance.now()) / 1000))
    countdown.textContent = `${left}s left, ${samples.keydown.length} key presses so far`
  }, 250)

  await Promise.race([finished, sleep(config.interactionWindowMs)])
  clearInterval(timer)
  // Let the last rAF + message settle so its sample lands.
  await sleep(200)
  panel.hidden = true
}

// ── Run ───────────────────────────────────────────────────────────────────

async function run(): Promise<void> {
  const notAttempted: RequestOutcome = { outcome: 'not-attempted' }
  const bridge = (window as unknown as { craft?: CraftBridgeLike }).craft
  const payload: ProbePagePayload = {
    config,
    userAgent: navigator.userAgent,
    devicePixelRatio,
    screen: { width: screen.width, height: screen.height },
    isSecureContext,
    timerResolutionMs: timerResolution(),
    eventTimeStampComparable: eventTimeStampComparable(),
    bridge: { present: Boolean(bridge), setFullscreen: typeof bridge?.window?.setFullscreen === 'function' },
    webgl2: { ok: false },
    webgpu: { present: false, adapter: false, device: false },
    frames: { idle: [], load: [], triangles: 0, hiddenDuringSampling: false, focused: false },
    input: samples,
    audio: { present: false },
    gamepad: { present: typeof navigator.getGamepads === 'function', connected: 0, ids: [], connectedEventSeen: false },
    fullscreen: {
      elementApi: typeof (document.documentElement as { requestFullscreen?: unknown }).requestFullscreen === 'function',
      webkitElementApi: typeof (document.documentElement as unknown as { webkitRequestFullscreen?: unknown }).webkitRequestFullscreen === 'function',
      enabled: typeof document.fullscreenEnabled === 'boolean' ? document.fullscreenEnabled : null,
      ungestured: notAttempted,
      gestured: notAttempted,
      nativeBridge: notAttempted,
    },
    pointerLock: { api: typeof canvas.requestPointerLock === 'function', ungestured: notAttempted, gestured: notAttempted },
    interaction: { windowMs: config.interactionWindowMs, sawRealInput: false, skipped: false },
    errors,
  }

  addEventListener('gamepadconnected', () => {
    payload.gamepad.connectedEventSeen = true
  })
  const stopListening = listenForInput()

  say('Probing WebGL2 and WebGPU')
  payload.webgl2 = probeWebgl2()
  payload.webgpu = await probeWebgpu()

  say('Probing audio')
  payload.audio = await probeAudio()

  say('Requesting fullscreen and pointer lock without a gesture (expected to be refused)')
  payload.fullscreen.ungestured = await requestFullscreen(document.documentElement)
  await exitFullscreen()
  payload.pointerLock.ungestured = await requestPointerLock(canvas)

  say(`Frame pacing: idle for ${config.idleMs / 1000}s`)
  const idle = await sampleFrames(config.idleMs)

  let scene: Scene
  try {
    scene = webglScene(config.instances) ?? canvas2dScene()
  }
  catch (error) {
    errors.push(`load scene: ${errorText(error)}`)
    scene = canvas2dScene()
  }
  // Warm up first: the first draw compiles shaders and uploads buffers, and a
  // one-off 90 ms frame from that is a loading cost, not a pacing problem.
  for (let i = 0; i < 10; i++)
    scene.draw(await nextFrame())

  say(`Frame pacing: ${scene.triangles.toLocaleString()} triangles + ${config.cpuLoadMsPerFrame} ms CPU per frame for ${config.loadMs / 1000}s`)
  const load = await sampleFrames(config.loadMs, (time) => {
    busyWait(config.cpuLoadMsPerFrame)
    scene.draw(time)
  })
  payload.frames = {
    idle: idle.timestamps,
    load: load.timestamps,
    triangles: scene.triangles,
    hiddenDuringSampling: idle.hidden || load.hidden,
    focused: document.hasFocus(),
  }

  say('Waiting for real input (see the panel), or for the window to time out')
  await interactivePhase(payload)
  stopListening()

  const pads = typeof navigator.getGamepads === 'function' ? [...navigator.getGamepads()].filter(Boolean) : []
  payload.gamepad.connected = pads.length
  payload.gamepad.ids = pads.map(pad => pad!.id)

  if (config.tryNativeFullscreen && payload.bridge.setFullscreen) {
    say('Trying Craft\'s native window fullscreen through window.craft')
    payload.fullscreen.nativeBridge = await nativeFullscreen()
  }

  payload.interaction.sawRealInput = sawRealInput
  await audioContext?.close().catch(() => {})

  say('Sending results')
  await fetch('/results', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
  say('Done. Results were sent to the runner; this window can close.')
}

run().catch((error) => {
  const message = errorText(error)
  say(`Probe failed: ${message}`)
  void fetch('/failed', { method: 'POST', body: message }).catch(() => {})
})
