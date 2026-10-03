/**
 * The shape of one interactive-content measurement (stacksjs/stacks#877).
 *
 * A record is data, not prose: it says when it was taken, against which host
 * (a Craft window or a browser) at which version, on which OS and machine. That
 * is what lets it go stale visibly - a reader sees "Craft 0.0.105, macOS 27.0,
 * 2026-10-02" beside every number and can tell how far that is from what they
 * run.
 *
 * Every probe carries a status and a note. A probe that could not run - input
 * latency with nobody at the keyboard, pointer lock without a user gesture, a
 * gamepad with none attached - says `requires-interaction` and what was still
 * observable. It never carries a number it did not measure.
 */

export const PROBE_SCHEMA_VERSION = 1

export type ProbeStatus =
  /** The API is present and the probe exercised it successfully. */
  | 'available'
  /** The API is absent, or creating it failed. */
  | 'unavailable'
  /** Numbers were taken; see `data`. */
  | 'measured'
  /** Needs real input, a user gesture or hardware that this run did not have. */
  | 'requires-interaction'
  /** Requested with a real user gesture and refused. */
  | 'denied'
  /** The probe threw; `note` carries the message. */
  | 'error'

export const PROBE_STATUSES: readonly ProbeStatus[] = ['available', 'unavailable', 'measured', 'requires-interaction', 'denied', 'error']

export type ProbeName =
  | 'webgl2'
  | 'webgpu'
  | 'framePacing'
  | 'inputLatency'
  | 'audioLatency'
  | 'gamepad'
  | 'fullscreen'
  | 'pointerLock'

/** Probe order, and the label each is published under. */
export const PROBE_NAMES: ReadonlyArray<[ProbeName, string]> = [
  ['webgl2', 'WebGL2'],
  ['webgpu', 'WebGPU'],
  ['framePacing', 'Frame pacing'],
  ['inputLatency', 'Input latency'],
  ['audioLatency', 'Audio latency'],
  ['gamepad', 'Gamepad API'],
  ['fullscreen', 'Fullscreen'],
  ['pointerLock', 'Pointer lock'],
]

export interface ProbeResult {
  status: ProbeStatus
  /** What was observed, in one or two sentences. Required, including on success. */
  note: string
  /** The raw figures behind the status. Probe-specific; absent when nothing was measured. */
  data?: Record<string, unknown>
}

export interface InteractiveProbeRecord {
  schema: typeof PROBE_SCHEMA_VERSION
  /** ISO 8601 timestamp of the run. */
  measuredAt: string
  host: {
    /** A Craft window, or an ordinary browser for comparison. */
    kind: 'craft' | 'browser'
    /** `craft`, `Safari`, `Chrome`, ... */
    name: string
    /** `craft --version` for Craft; the browser's own version otherwise. */
    version: string
    userAgent: string
  }
  os: {
    platform: string
    arch: string
    /** e.g. `macOS`. */
    name: string
    /** e.g. `27.0`. */
    version: string
    build?: string
  }
  machine: {
    /** e.g. `Mac15,6`. */
    model: string
    /** e.g. `Apple M3 Pro`. */
    cpu: string
    display: {
      name: string
      resolution: string
      /** The display's own refresh rate, read natively; null when it could not be. */
      refreshHz: number | null
      devicePixelRatio: number
    }
  }
  /** The parameters the run used, so two records can be compared fairly. */
  run: {
    idleMs: number
    loadMs: number
    /** Busy-wait added to every frame of the load phase to simulate game logic. */
    cpuLoadMsPerFrame: number
    /** Triangles drawn per frame in the load phase (0 when WebGL2 was unavailable). */
    triangles: number
    /** How long the page waited for real input before giving up. */
    interactionWindowMs: number
    /** Whether any trusted (real) input event reached the page. */
    sawRealInput: boolean
  }
  probes: Record<ProbeName, ProbeResult>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

/**
 * Every way `value` fails to be an `InteractiveProbeRecord`, as readable
 * messages. An empty array means it is valid.
 *
 * Hand-written rather than a schema library because the desktop package has no
 * validation dependency and this is the one shape it checks.
 */
export function validateProbeRecord(value: unknown): string[] {
  const errors: string[] = []
  if (!isRecord(value))
    return ['record is not an object']

  if (value.schema !== PROBE_SCHEMA_VERSION)
    errors.push(`schema must be ${PROBE_SCHEMA_VERSION}, got ${JSON.stringify(value.schema)}`)

  if (!nonEmptyString(value.measuredAt) || Number.isNaN(Date.parse(value.measuredAt)))
    errors.push('measuredAt must be an ISO 8601 timestamp')

  const host = value.host
  if (!isRecord(host)) {
    errors.push('host is missing')
  }
  else {
    if (host.kind !== 'craft' && host.kind !== 'browser')
      errors.push(`host.kind must be craft or browser, got ${JSON.stringify(host.kind)}`)
    for (const key of ['name', 'version', 'userAgent'] as const) {
      if (!nonEmptyString(host[key]))
        errors.push(`host.${key} is required`)
    }
    if (host.kind === 'craft' && nonEmptyString(host.version) && !/^\d+\.\d+\.\d+/.test(host.version))
      errors.push(`host.version must be a Craft release version, got ${JSON.stringify(host.version)}`)
  }

  const os = value.os
  if (!isRecord(os)) {
    errors.push('os is missing')
  }
  else {
    for (const key of ['platform', 'arch', 'name', 'version'] as const) {
      if (!nonEmptyString(os[key]))
        errors.push(`os.${key} is required`)
    }
  }

  const machine = value.machine
  if (!isRecord(machine)) {
    errors.push('machine is missing')
  }
  else {
    for (const key of ['model', 'cpu'] as const) {
      if (!nonEmptyString(machine[key]))
        errors.push(`machine.${key} is required`)
    }
    const display = machine.display
    if (!isRecord(display)) {
      errors.push('machine.display is missing')
    }
    else {
      if (display.refreshHz !== null && !(typeof display.refreshHz === 'number' && display.refreshHz > 0))
        errors.push('machine.display.refreshHz must be a positive number or null')
      if (!(typeof display.devicePixelRatio === 'number' && display.devicePixelRatio > 0))
        errors.push('machine.display.devicePixelRatio must be a positive number')
    }
  }

  const run = value.run
  if (!isRecord(run)) {
    errors.push('run is missing')
  }
  else {
    for (const key of ['idleMs', 'loadMs', 'cpuLoadMsPerFrame', 'triangles', 'interactionWindowMs'] as const) {
      if (!(typeof run[key] === 'number' && run[key] >= 0))
        errors.push(`run.${key} must be a non-negative number`)
    }
    if (typeof run.sawRealInput !== 'boolean')
      errors.push('run.sawRealInput must be a boolean')
  }

  const probes = value.probes
  if (!isRecord(probes)) {
    errors.push('probes is missing')
    return errors
  }

  for (const [name] of PROBE_NAMES) {
    const probe = probes[name]
    if (!isRecord(probe)) {
      errors.push(`probes.${name} is missing`)
      continue
    }
    if (!PROBE_STATUSES.includes(probe.status as ProbeStatus))
      errors.push(`probes.${name}.status must be one of ${PROBE_STATUSES.join(', ')}, got ${JSON.stringify(probe.status)}`)
    if (!nonEmptyString(probe.note))
      errors.push(`probes.${name}.note is required: say what was observed, even on success`)
    if (probe.data !== undefined && !isRecord(probe.data))
      errors.push(`probes.${name}.data must be an object when present`)
    // A measured probe without figures is a claim with nothing behind it.
    if (probe.status === 'measured' && !isRecord(probe.data))
      errors.push(`probes.${name} is measured but carries no data`)
  }

  for (const name of Object.keys(probes)) {
    if (!PROBE_NAMES.some(([known]) => known === name))
      errors.push(`probes.${name} is not a known probe`)
  }

  return errors
}

/** Throw with every validation error at once, or return the value typed. */
export function assertProbeRecord(value: unknown, source = 'probe record'): InteractiveProbeRecord {
  const errors = validateProbeRecord(value)
  if (errors.length > 0)
    throw new Error(`${source} is invalid:\n- ${errors.join('\n- ')}`)
  return value as InteractiveProbeRecord
}
