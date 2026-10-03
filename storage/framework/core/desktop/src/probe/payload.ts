/**
 * What the probe page posts back to its runner (stacksjs/stacks#877).
 *
 * Raw observations only. The page does no statistics and makes no judgement:
 * `buildProbeRecord` in `record.ts` turns this into a published record, which is
 * where the arithmetic and the status rules live and are unit-tested.
 */

/** Configuration the runner embeds in the page. */
export interface ProbePageConfig {
  /** Milliseconds of rAF sampling with nothing drawn. */
  idleMs: number
  /** Milliseconds of rAF sampling with the WebGL2 scene and CPU load running. */
  loadMs: number
  /** Busy-wait per frame in the load phase, standing in for game logic. */
  cpuLoadMsPerFrame: number
  /** Instanced cubes drawn per frame in the load phase (12 triangles each). */
  instances: number
  /** How long to wait for real input. 0 skips the interactive phase entirely. */
  interactionWindowMs: number
  /** Try Craft's native window fullscreen through `window.craft` when present. */
  tryNativeFullscreen: boolean
}

export const DEFAULT_PROBE_PAGE_CONFIG: ProbePageConfig = {
  idleMs: 3000,
  loadMs: 6000,
  cpuLoadMsPerFrame: 6,
  instances: 40_000,
  interactionWindowMs: 20_000,
  tryNativeFullscreen: true,
}

/** The result of asking for fullscreen or pointer lock. */
export interface RequestOutcome {
  outcome: 'entered' | 'rejected' | 'no-api' | 'timeout' | 'not-attempted'
  /** The error name/message, or the event that settled it. */
  detail?: string
}

/** One input event, timed to the frame that could first show it. */
export interface InputSample {
  /** `performance.now()` at the next rAF callback minus `event.timeStamp`. */
  toFrameMs: number
  /** Same, at a message posted after that rAF callback: a proxy for "after paint". */
  toPostFrameMs: number
}

export interface AudioSnapshot {
  state: string
  baseLatency: number | null
  outputLatency: number | null
  sampleRate: number
}

export interface ProbePagePayload {
  config: ProbePageConfig
  userAgent: string
  devicePixelRatio: number
  screen: { width: number, height: number }
  isSecureContext: boolean
  /** Smallest non-zero step observed in `performance.now()`. WebKit clamps it to 1 ms. */
  timerResolutionMs: number
  /** Whether `event.timeStamp` shares `performance.now()`'s time origin. */
  eventTimeStampComparable: boolean
  bridge: { present: boolean, setFullscreen: boolean }
  webgl2: {
    ok: boolean
    error?: string
    version?: string
    shadingLanguageVersion?: string
    vendor?: string
    renderer?: string
    unmaskedVendor?: string
    unmaskedRenderer?: string
    maxTextureSize?: number
    maxSamples?: number
    extensions?: number
  }
  webgpu: {
    present: boolean
    adapter: boolean
    device: boolean
    error?: string
    vendor?: string
    architecture?: string
    description?: string
    maxTextureDimension2D?: number
    features?: number
  }
  frames: {
    idle: number[]
    load: number[]
    /** Triangles drawn per load frame; 0 when WebGL2 was unavailable and the 2D fallback ran. */
    triangles: number
    /** Whether the page was hidden at any point while sampling (which throttles rAF). */
    hiddenDuringSampling: boolean
    /** Whether the document had focus when sampling ended. */
    focused: boolean
  }
  input: {
    pointerdown: InputSample[]
    pointermove: InputSample[]
    keydown: InputSample[]
    /** `PerformanceObserver` supports `event` entries (Event Timing API). */
    eventTimingSupported: boolean
    /** Event Timing `duration` values (rounded to 8 ms by the spec). */
    eventTimingDurations: number[]
  }
  audio: {
    present: boolean
    error?: string
    initial?: AudioSnapshot
    /** After `resume()` with no user gesture. */
    afterUngesturedResume?: AudioSnapshot
    /** After `resume()` inside a real click. */
    afterGesturedResume?: AudioSnapshot
  }
  gamepad: {
    present: boolean
    connected: number
    ids: string[]
    connectedEventSeen: boolean
  }
  fullscreen: {
    elementApi: boolean
    webkitElementApi: boolean
    enabled: boolean | null
    ungestured: RequestOutcome
    gestured: RequestOutcome
    /** Craft's own `window.craft.window.setFullscreen`, which needs no gesture. */
    nativeBridge: RequestOutcome & { sizeBefore?: string, sizeAfter?: string }
  }
  pointerLock: {
    api: boolean
    ungestured: RequestOutcome
    gestured: RequestOutcome
  }
  interaction: {
    windowMs: number
    sawRealInput: boolean
    skipped: boolean
  }
  errors: string[]
}
