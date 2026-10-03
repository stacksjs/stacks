/**
 * Turning what the probe page saw into a published record (stacksjs/stacks#877).
 *
 * The page posts raw timestamps and outcomes; this decides each probe's status
 * and summarises the numbers. The rule throughout: a status is only as strong as
 * what was actually observed. No trusted input means `requires-interaction`,
 * not a latency of zero; a request that was never made with a gesture is not a
 * refusal.
 */

import type { ProbePagePayload, RequestOutcome } from './payload'
import type { InteractiveProbeRecord, ProbeResult } from './schema'
import { PROBE_SCHEMA_VERSION } from './schema'
import { framePacing, intervals, latency, percentile, snapRefreshRate } from './stats'

/** What the runner knows about the host that the page cannot see. */
export interface ProbeHostFacts {
  measuredAt: string
  host: { kind: 'craft' | 'browser', name: string, version: string }
  os: InteractiveProbeRecord['os']
  machine: {
    model: string
    cpu: string
    display: { name: string, resolution: string, refreshHz: number | null }
  }
}

/** The browser and version a user agent string names, best effort. */
export function browserFromUserAgent(userAgent: string): { name: string, version: string } {
  const patterns: Array<[string, RegExp]> = [
    ['Edge', /Edg\/([\d.]+)/],
    ['Firefox', /Firefox\/([\d.]+)/],
    ['Chrome', /Chrome\/([\d.]+)/],
    ['Safari', /Version\/([\d.]+).*Safari\//],
    ['WebKit', /AppleWebKit\/([\d.]+)/],
  ]
  for (const [name, pattern] of patterns) {
    const match = userAgent.match(pattern)
    if (match)
      return { name, version: match[1]! }
  }
  return { name: 'unknown', version: 'unknown' }
}

function ms(seconds: number | null | undefined): string {
  return typeof seconds === 'number' ? `${Math.round(seconds * 10_000) / 10} ms` : 'not reported'
}

function describeOutcome(outcome: RequestOutcome): string {
  return outcome.detail ? `${outcome.outcome} (${outcome.detail})` : outcome.outcome
}

function webgl2(payload: ProbePagePayload): ProbeResult {
  const gl = payload.webgl2
  if (!gl.ok)
    return { status: 'unavailable', note: `No WebGL2 context: ${gl.error ?? 'unknown reason'}.`, data: { ...gl } }
  const renderer = gl.unmaskedRenderer || gl.renderer
  return {
    status: 'available',
    note: `WebGL2 context created (${gl.version}); renderer "${renderer}", max texture ${gl.maxTextureSize}, MSAA up to ${gl.maxSamples}x.`,
    data: { ...gl },
  }
}

function webgpu(payload: ProbePagePayload): ProbeResult {
  const gpu = payload.webgpu
  if (!gpu.present)
    return { status: 'unavailable', note: 'navigator.gpu is undefined.', data: { ...gpu } }
  if (!gpu.adapter || !gpu.device)
    return { status: 'unavailable', note: `navigator.gpu exists but ${gpu.adapter ? 'requestDevice()' : 'requestAdapter()'} failed: ${gpu.error ?? 'no reason given'}.`, data: { ...gpu } }
  const name = [...new Set([gpu.vendor, gpu.architecture].filter(Boolean))].join(' ') || 'unnamed adapter'
  return {
    status: 'available',
    note: `Adapter (${name}) and device created; maxTextureDimension2D ${gpu.maxTextureDimension2D ?? 'unknown'}.`,
    data: { ...gpu },
  }
}

function pacing(payload: ProbePagePayload, facts: ProbeHostFacts): ProbeResult {
  const { frames, config } = payload
  if (frames.idle.length < 3 || frames.load.length < 3)
    return { status: 'error', note: `Too few animation frames to measure (${frames.idle.length} idle, ${frames.load.length} under load).` }

  const rafHz = snapRefreshRate(percentile(intervals(frames.idle), 50)!)
  const displayHz = facts.machine.display.refreshHz ?? rafHz
  const idle = framePacing(frames.idle, displayHz)!
  const load = framePacing(frames.load, displayHz)!
  const loadAtRaf = framePacing(frames.load, rafHz)!

  const data = {
    rafHz,
    displayHz,
    timerResolutionMs: payload.timerResolutionMs,
    triangles: frames.triangles,
    cpuLoadMsPerFrame: config.cpuLoadMsPerFrame,
    hiddenDuringSampling: frames.hiddenDuringSampling,
    idle,
    load,
    loadAtRafRate: { droppedFrames: loadAtRaf.droppedFrames, longFrames: loadAtRaf.longFrames },
  }

  if (frames.hiddenDuringSampling) {
    return {
      status: 'error',
      note: 'The page was hidden while sampling, which throttles requestAnimationFrame; these numbers are not representative. Re-run with the window visible.',
      data,
    }
  }

  const cap = rafHz < displayHz - 1
    ? `requestAnimationFrame ran at ${rafHz} Hz on a ${displayHz} Hz display, so a game cannot reach the panel's rate. `
    : `requestAnimationFrame ran at the display's ${displayHz} Hz. `
  const work = frames.triangles > 0 ? `${frames.triangles.toLocaleString('en-US')} triangles` : 'a 2D canvas fallback'
  return {
    status: 'measured',
    note: `${cap}Under load (${work} + ${config.cpuLoadMsPerFrame} ms CPU per frame): p50 ${load.p50Ms} ms, p95 ${load.p95Ms} ms, p99 ${load.p99Ms} ms; ${loadAtRaf.droppedFrames} frames dropped at ${rafHz} Hz and ${load.droppedFrames} at the display's ${displayHz} Hz over ${Math.round(load.durationMs / 100) / 10} s.${payload.timerResolutionMs >= 0.5 ? ` The page clock is clamped to ${payload.timerResolutionMs} ms, so intervals read as whole milliseconds.` : ''}`,
    data,
  }
}

/** Fewer trusted input events than this is reported, not summarised. */
export const MIN_INPUT_SAMPLES = 5

function inputLatency(payload: ProbePagePayload): ProbeResult {
  const { input } = payload
  const context = {
    eventTimeStampComparable: payload.eventTimeStampComparable,
    eventTimingSupported: input.eventTimingSupported,
    timerResolutionMs: payload.timerResolutionMs,
  }
  if (!payload.eventTimeStampComparable)
    return { status: 'error', note: 'event.timeStamp does not share performance.now()\'s time origin, so event-to-frame time cannot be computed.', data: context }

  const kinds = { pointerdown: input.pointerdown, pointermove: input.pointermove, keydown: input.keydown } as const
  const total = Object.values(kinds).reduce((sum, list) => sum + list.length, 0)
  if (total === 0) {
    const window = payload.interaction.skipped ? 'The interactive window was skipped' : `No trusted input reached the page in the ${payload.interaction.windowMs / 1000} s window`
    return {
      status: 'requires-interaction',
      note: `${window}, and synthetic events are not counted. Observable: event.timeStamp is on the performance.now() clock, timer resolution ${payload.timerResolutionMs} ms, Event Timing API ${input.eventTimingSupported ? 'supported' : 'not supported'}.`,
      data: context,
    }
  }

  const summary: Record<string, unknown> = { ...context }
  const parts: string[] = []
  for (const [kind, list] of Object.entries(kinds)) {
    const toFrame = latency(list.map(sample => sample.toFrameMs))
    const toPostFrame = latency(list.map(sample => sample.toPostFrameMs))
    summary[kind] = { toFrame, toPostFrame }
    if (toFrame)
      parts.push(`${kind} p50 ${toFrame.p50Ms} ms to next frame (${toFrame.samples} ${toFrame.samples === 1 ? 'sample' : 'samples'})`)
  }
  summary.eventTiming = latency(input.eventTimingDurations)
  if (total < MIN_INPUT_SAMPLES) {
    // A stray mouse movement is real input, but one sample is an anecdote,
    // not a percentile. Keep what was seen and say it was not enough.
    return {
      status: 'requires-interaction',
      note: `Only ${total} trusted input ${total === 1 ? 'event' : 'events'} arrived, fewer than the ${MIN_INPUT_SAMPLES} needed to summarise. Seen: ${parts.join('; ')}. Re-run and use the panel's buttons and keys.`,
      data: summary,
    }
  }
  return {
    status: 'measured',
    note: `Event timestamp to the next rAF callback: ${parts.join('; ')}. Real input from the OS; no synthetic events.`,
    data: summary,
  }
}

function audio(payload: ProbePagePayload): ProbeResult {
  const a = payload.audio
  if (!a.present)
    return { status: 'unavailable', note: 'window.AudioContext is undefined.' }
  if (a.error || !a.initial)
    return { status: 'error', note: `Creating an AudioContext failed: ${a.error ?? 'unknown reason'}.` }

  const best = a.afterGesturedResume ?? a.afterUngesturedResume ?? a.initial
  const data = { initial: a.initial, afterUngesturedResume: a.afterUngesturedResume ?? null, afterGesturedResume: a.afterGesturedResume ?? null }
  const figures = `baseLatency ${ms(best.baseLatency)}, outputLatency ${ms(best.outputLatency)} at ${best.sampleRate} Hz`
  const unattended = a.afterUngesturedResume?.state === 'running'
    ? 'The context started without a user gesture'
    : 'The context stayed suspended without a user gesture'

  if (best.state !== 'running') {
    return {
      status: 'requires-interaction',
      note: `${unattended}, so device latency was not observable. Reported before running: ${figures}.`,
      data,
    }
  }
  if (best.baseLatency === null && best.outputLatency === null)
    return { status: 'unavailable', note: `${unattended}, but neither baseLatency nor outputLatency is implemented.`, data }

  return {
    status: 'measured',
    note: `${unattended}. ${figures}${best.outputLatency === null ? ' (outputLatency not implemented)' : ''}.`,
    data,
  }
}

function gamepad(payload: ProbePagePayload): ProbeResult {
  const g = payload.gamepad
  if (!g.present)
    return { status: 'unavailable', note: 'navigator.getGamepads is undefined.' }
  return {
    status: 'available',
    note: g.connected > 0
      ? `navigator.getGamepads() is present and reported ${g.connected} controller(s).`
      : 'navigator.getGamepads() is present; no controller was connected, so axis and button input was not exercised.',
    data: { ...g, secureContext: payload.isSecureContext },
  }
}

function fullscreen(payload: ProbePagePayload): ProbeResult {
  const f = payload.fullscreen
  const native = f.nativeBridge.outcome === 'not-attempted' || f.nativeBridge.outcome === 'no-api'
    ? ''
    : ` Craft's own window.craft.window.setFullscreen(true), which needs no gesture: ${describeOutcome(f.nativeBridge)}.`
  const data = { ...f }

  if (!f.elementApi && !f.webkitElementApi)
    return { status: 'unavailable', note: `Element.requestFullscreen and webkitRequestFullscreen are both undefined, so the standard Fullscreen API engines call does nothing.${native}`, data }

  const ungestured = `Without a gesture: ${describeOutcome(f.ungestured)}.`
  switch (f.gestured.outcome) {
    case 'entered':
      return { status: 'available', note: `requestFullscreen() from a real click entered fullscreen. ${ungestured}${native}`, data }
    case 'rejected':
    case 'timeout':
      return { status: 'denied', note: `requestFullscreen() from a real click: ${describeOutcome(f.gestured)}. ${ungestured}${native}`, data }
    default:
      return { status: 'requires-interaction', note: `The API exists (fullscreenEnabled ${String(f.enabled)}) but needs a real click to test. ${ungestured}${native}`, data }
  }
}

function pointerLock(payload: ProbePagePayload): ProbeResult {
  const p = payload.pointerLock
  const data = { ...p }
  if (!p.api)
    return { status: 'unavailable', note: 'Element.requestPointerLock is undefined.', data }

  const ungestured = `Without a gesture: ${describeOutcome(p.ungestured)}.`
  switch (p.gestured.outcome) {
    case 'entered':
      return { status: 'available', note: `requestPointerLock() from a real click locked the pointer. ${ungestured}`, data }
    case 'rejected':
    case 'timeout':
      return { status: 'denied', note: `requestPointerLock() from a real click: ${describeOutcome(p.gestured)}. ${ungestured}`, data }
    default:
      return { status: 'requires-interaction', note: `The API exists but needs a real click to test. ${ungestured}`, data }
  }
}

/** Combine the page's observations with the runner's host facts into a record. */
export function buildProbeRecord(payload: ProbePagePayload, facts: ProbeHostFacts): InteractiveProbeRecord {
  return {
    schema: PROBE_SCHEMA_VERSION,
    measuredAt: facts.measuredAt,
    host: { ...facts.host, userAgent: payload.userAgent },
    os: facts.os,
    machine: {
      model: facts.machine.model,
      cpu: facts.machine.cpu,
      display: { ...facts.machine.display, devicePixelRatio: payload.devicePixelRatio },
    },
    run: {
      idleMs: payload.config.idleMs,
      loadMs: payload.config.loadMs,
      cpuLoadMsPerFrame: payload.config.cpuLoadMsPerFrame,
      triangles: payload.frames.triangles,
      interactionWindowMs: payload.interaction.windowMs,
      sawRealInput: payload.interaction.sawRealInput,
    },
    probes: {
      webgl2: webgl2(payload),
      webgpu: webgpu(payload),
      framePacing: pacing(payload, facts),
      inputLatency: inputLatency(payload),
      audioLatency: audio(payload),
      gamepad: gamepad(payload),
      fullscreen: fullscreen(payload),
      pointerLock: pointerLock(payload),
    },
  }
}
