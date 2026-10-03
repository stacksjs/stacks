// The interactive-content probe (stacksjs/stacks#877).
//
// The harness itself needs a visible window and cannot run in CI. Everything
// that turns what it saw into a published claim can: the frame-time arithmetic,
// the status rules (no trusted input is `requires-interaction`, never a zero),
// the record schema, and the capability-matrix section rendered from the
// checked-in records - which must match the published page, the same freshness
// check the driver matrix and the desktop support matrix already have.

import type { ProbePagePayload } from '../src/probe/payload'
import type { ProbeHostFacts } from '../src/probe/record'
import type { InteractiveProbeRecord } from '../src/probe/schema'
import { describe, expect, test } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { DEFAULT_PROBE_PAGE_CONFIG } from '../src/probe/payload'
import { browserFromUserAgent, buildProbeRecord, MIN_INPUT_SAMPLES } from '../src/probe/record'
import { loadProbeRecords, PROBE_RESULTS_DIR, probeRecordFileName } from '../src/probe/records'
import { headline, INTERACTIVE_BEGIN, INTERACTIVE_END, orderRecords, renderInteractiveCapabilities } from '../src/probe/render'
import { mainDisplayFromProfiler, parseCraftVersion } from '../src/probe/runner'
import { PROBE_NAMES, validateProbeRecord } from '../src/probe/schema'
import { droppedFrames, framePacing, histogram, intervals, latency, parseRefreshHz, percentile, snapRefreshRate } from '../src/probe/stats'

const capabilitiesPage = join(import.meta.dir, '../../../../../docs/features/capabilities.md')

/** rAF timestamps at a steady period, with optional extra gaps (in periods) after given frames. */
function frames(count: number, periodMs: number, gaps: Record<number, number> = {}): number[] {
  const out: number[] = []
  let time = 1000
  for (let i = 0; i < count; i++) {
    out.push(time)
    time += periodMs * (gaps[i] ?? 1)
  }
  return out
}

function payload(overrides: Partial<ProbePagePayload> = {}): ProbePagePayload {
  return {
    config: { ...DEFAULT_PROBE_PAGE_CONFIG },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko)',
    devicePixelRatio: 2,
    screen: { width: 1512, height: 982 },
    isSecureContext: true,
    timerResolutionMs: 1,
    eventTimeStampComparable: true,
    bridge: { present: true, setFullscreen: true },
    webgl2: { ok: true, version: 'WebGL 2.0', renderer: 'Apple GPU', maxTextureSize: 16384, maxSamples: 4 },
    webgpu: { present: true, adapter: true, device: true, vendor: 'apple', architecture: 'apple', maxTextureDimension2D: 16384 },
    frames: { idle: frames(180, 1000 / 60), load: frames(360, 1000 / 60, { 100: 2 }), triangles: 480_000, hiddenDuringSampling: false, focused: true },
    input: { pointerdown: [], pointermove: [], keydown: [], eventTimingSupported: true, eventTimingDurations: [] },
    audio: {
      present: true,
      initial: { state: 'suspended', baseLatency: 0.00267, outputLatency: 0, sampleRate: 48_000 },
      afterUngesturedResume: { state: 'running', baseLatency: 0.00267, outputLatency: 0.0158, sampleRate: 48_000 },
    },
    gamepad: { present: true, connected: 0, ids: [], connectedEventSeen: false },
    fullscreen: {
      elementApi: false,
      webkitElementApi: false,
      enabled: null,
      ungestured: { outcome: 'no-api' },
      gestured: { outcome: 'no-api' },
      nativeBridge: { outcome: 'entered', detail: 'viewport grew to the screen' },
    },
    pointerLock: { api: true, ungestured: { outcome: 'rejected', detail: 'NotAllowedError' }, gestured: { outcome: 'not-attempted' } },
    interaction: { windowMs: 20_000, sawRealInput: false, skipped: false },
    errors: [],
    ...overrides,
  }
}

const facts: ProbeHostFacts = {
  measuredAt: '2026-10-02T12:00:00.000Z',
  host: { kind: 'craft', name: 'craft', version: '0.0.105' },
  os: { platform: 'darwin', arch: 'arm64', name: 'macOS', version: '27.0', build: '26A428' },
  machine: { model: 'Mac15,6', cpu: 'Apple M3 Pro', display: { name: 'Color LCD', resolution: '1512 x 982 @ 120.00Hz', refreshHz: 120 } },
}

describe('stats', () => {
  test('percentile interpolates between closest ranks', () => {
    expect(percentile([1, 2, 3, 4], 50)).toBe(2.5)
    expect(percentile([10, 20, 30, 40, 50], 0)).toBe(10)
    expect(percentile([10, 20, 30, 40, 50], 100)).toBe(50)
    expect(percentile([10, 20, 30, 40, 50], 95)).toBeCloseTo(48)
    // Order of input does not matter, and the input is not mutated.
    const input = [5, 1, 4, 2, 3]
    expect(percentile(input, 50)).toBe(3)
    expect(input).toEqual([5, 1, 4, 2, 3])
  })

  test('percentile of nothing is null, not zero', () => {
    expect(percentile([], 50)).toBeNull()
    expect(() => percentile([1], 101)).toThrow(RangeError)
  })

  test('histogram buckets by width and counts the overflow separately', () => {
    const result = histogram([0, 0.5, 1, 16.7, 16.9, 49.99, 50, 120], 1, 50)
    expect(result.counts[0]).toBe(2)
    expect(result.counts[1]).toBe(1)
    expect(result.counts[16]).toBe(2)
    expect(result.counts[49]).toBe(1)
    expect(result.overflow).toBe(2)
    expect(result.counts.reduce((a, b) => a + b, 0) + result.overflow).toBe(8)
  })

  test('snapRefreshRate recognises common panels and leaves odd ones alone', () => {
    expect(snapRefreshRate(1000 / 120)).toBe(120)
    expect(snapRefreshRate(17)).toBe(60) // a 1 ms-clamped 60 Hz interval
    expect(snapRefreshRate(1000 / 144)).toBe(144)
    expect(snapRefreshRate(9.5)).toBe(105.26)
  })

  test('droppedFrames counts whole skipped periods', () => {
    const period = 1000 / 60
    expect(droppedFrames([period, period * 2, period * 3, period * 1.4], period)).toBe(3)
  })

  test('framePacing summarises a run against the target rate', () => {
    const stats = framePacing(frames(61, 1000 / 60, { 30: 3 }), 60)!
    expect(stats.frames).toBe(61)
    expect(stats.targetHz).toBe(60)
    expect(stats.droppedFrames).toBe(2)
    expect(stats.longFrames).toBe(1)
    expect(stats.p50Ms).toBeCloseTo(16.67, 1)
    expect(stats.maxMs).toBeCloseTo(50, 0)

    // The same 60 Hz run against a 120 Hz panel drops every other frame.
    const atPanel = framePacing(frames(61, 1000 / 60), 120)!
    expect(atPanel.droppedFrames).toBe(60)
    expect(framePacing([1, 2], 60)).toBeNull()
  })

  test('latency ignores negative and non-finite samples', () => {
    expect(latency([])).toBeNull()
    expect(latency([-1, Number.NaN])).toBeNull()
    expect(latency([4, 6, 8, -3])).toEqual({ samples: 3, p50Ms: 6, p95Ms: 7.8, maxMs: 8 })
  })

  test('intervals and parseRefreshHz', () => {
    expect(intervals([0, 16, 33])).toEqual([16, 17])
    expect(parseRefreshHz('1512 x 982 @ 120.00Hz')).toBe(120)
    expect(parseRefreshHz('3840 x 2160')).toBeNull()
    expect(parseRefreshHz(undefined)).toBeNull()
  })
})

describe('host facts', () => {
  test('parseCraftVersion reads the first line of craft --version', () => {
    expect(parseCraftVersion('craft version 0.0.105\nBuilt with Zig 0.17.0-dev')).toBe('0.0.105')
    expect(parseCraftVersion('something else')).toBeNull()
    expect(parseCraftVersion(null)).toBeNull()
  })

  test('mainDisplayFromProfiler keeps the refresh rate and drops identifiers', () => {
    const json = JSON.stringify({
      SPDisplaysDataType: [{
        spdisplays_ndrvs: [
          { '_name': 'External', '_spdisplays_resolution': '2560 x 1440 @ 60.00Hz', 'spdisplays_main': 'spdisplays_no' },
          { '_name': 'Color LCD', '_spdisplays_resolution': '1512 x 982 @ 120.00Hz', '_spdisplays_display-serial-number': 'secret', 'spdisplays_main': 'spdisplays_yes' },
        ],
      }],
    })
    const display = mainDisplayFromProfiler(json)
    expect(display).toEqual({ name: 'Color LCD', resolution: '1512 x 982 @ 120.00Hz', refreshHz: 120 })
    expect(JSON.stringify(display)).not.toContain('secret')
    expect(mainDisplayFromProfiler('not json')).toBeNull()
  })

  test('browserFromUserAgent names the browser, and Craft as bare WebKit', () => {
    expect(browserFromUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.0 Safari/605.1.15'))
      .toEqual({ name: 'Safari', version: '27.0' })
    expect(browserFromUserAgent('Mozilla/5.0 (Macintosh) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36').name).toBe('Chrome')
    expect(browserFromUserAgent('Mozilla/5.0 (Macintosh) AppleWebKit/605.1.15 (KHTML, like Gecko)').name).toBe('WebKit')
  })
})

describe('buildProbeRecord', () => {
  test('produces a valid record', () => {
    const record = buildProbeRecord(payload(), facts)
    expect(validateProbeRecord(record)).toEqual([])
    expect(record.host).toMatchObject({ kind: 'craft', version: '0.0.105' })
    expect(record.machine.display.devicePixelRatio).toBe(2)
  })

  test('frame pacing reports both the rAF rate and the display rate', () => {
    const probe = buildProbeRecord(payload(), facts).probes.framePacing
    expect(probe.status).toBe('measured')
    expect(probe.data).toMatchObject({ rafHz: 60, displayHz: 120 })
    expect(probe.note).toContain('60 Hz on a 120 Hz display')
    expect((probe.data!.loadAtRafRate as { droppedFrames: number }).droppedFrames).toBe(1)
  })

  test('a hidden page makes frame pacing an error, not a measurement', () => {
    const hidden = payload({ frames: { ...payload().frames, hiddenDuringSampling: true } })
    expect(buildProbeRecord(hidden, facts).probes.framePacing.status).toBe('error')
  })

  test('no trusted input is requires-interaction, with no latency figure', () => {
    const probe = buildProbeRecord(payload(), facts).probes.inputLatency
    expect(probe.status).toBe('requires-interaction')
    expect(JSON.stringify(probe.data)).not.toContain('p50Ms')
  })

  test('too few input samples is still requires-interaction', () => {
    const few = payload({ input: { ...payload().input, pointermove: [{ toFrameMs: 6, toPostFrameMs: 7 }] } })
    expect(MIN_INPUT_SAMPLES).toBeGreaterThan(1)
    expect(buildProbeRecord(few, facts).probes.inputLatency.status).toBe('requires-interaction')
  })

  test('enough real input is measured', () => {
    const keys = Array.from({ length: 6 }, (_, i) => ({ toFrameMs: 4 + i, toPostFrameMs: 5 + i }))
    const probe = buildProbeRecord(payload({ input: { ...payload().input, keydown: keys } }), facts).probes.inputLatency
    expect(probe.status).toBe('measured')
    expect(headline('inputLatency', probe)).toBe('keydown p50 6.5 ms to next frame')
  })

  test('missing element fullscreen is unavailable even when the native bridge works', () => {
    const probe = buildProbeRecord(payload(), facts).probes.fullscreen
    expect(probe.status).toBe('unavailable')
    expect(probe.note).toContain('setFullscreen(true)')
  })

  test('fullscreen and pointer lock follow the gestured outcome', () => {
    const withApi = payload({
      fullscreen: { ...payload().fullscreen, elementApi: true, enabled: true, ungestured: { outcome: 'rejected' }, gestured: { outcome: 'entered' } },
      pointerLock: { api: true, ungestured: { outcome: 'rejected' }, gestured: { outcome: 'timeout' } },
    })
    const record = buildProbeRecord(withApi, facts)
    expect(record.probes.fullscreen.status).toBe('available')
    expect(record.probes.pointerLock.status).toBe('denied')
    expect(buildProbeRecord(payload(), facts).probes.pointerLock.status).toBe('requires-interaction')
  })

  test('audio that stays suspended without a gesture needs interaction', () => {
    const suspended = payload({
      audio: {
        present: true,
        initial: { state: 'suspended', baseLatency: 0.01, outputLatency: 0, sampleRate: 44_100 },
        afterUngesturedResume: { state: 'suspended', baseLatency: 0.01, outputLatency: 0, sampleRate: 44_100 },
      },
    })
    expect(buildProbeRecord(suspended, facts).probes.audioLatency.status).toBe('requires-interaction')
    expect(buildProbeRecord(payload(), facts).probes.audioLatency.status).toBe('measured')
  })

  test('absent APIs are unavailable', () => {
    const bare = payload({
      webgl2: { ok: false, error: 'null' },
      webgpu: { present: false, adapter: false, device: false },
      gamepad: { present: false, connected: 0, ids: [], connectedEventSeen: false },
      pointerLock: { api: false, ungestured: { outcome: 'no-api' }, gestured: { outcome: 'no-api' } },
      audio: { present: false },
    })
    const probes = buildProbeRecord(bare, facts).probes
    for (const name of ['webgl2', 'webgpu', 'gamepad', 'pointerLock', 'audioLatency'] as const)
      expect(probes[name].status).toBe('unavailable')
  })
})

describe('validateProbeRecord', () => {
  const valid = buildProbeRecord(payload(), facts)

  test('names every problem rather than the first', () => {
    const broken = { ...valid, schema: 2, measuredAt: 'yesterday', host: { ...valid.host, version: 'latest' } }
    const errors = validateProbeRecord(broken)
    expect(errors.some(error => error.startsWith('schema'))).toBe(true)
    expect(errors.some(error => error.startsWith('measuredAt'))).toBe(true)
    expect(errors.some(error => error.includes('Craft release version'))).toBe(true)
  })

  test('a measured probe must carry its data, and every probe its note', () => {
    const probes = { ...valid.probes, webgl2: { status: 'measured', note: 'x' }, webgpu: { status: 'available', note: ' ' } }
    const errors = validateProbeRecord({ ...valid, probes })
    expect(errors).toContain('probes.webgl2 is measured but carries no data')
    expect(errors.some(error => error.startsWith('probes.webgpu.note'))).toBe(true)
  })

  test('missing and unknown probes are both errors', () => {
    const { gamepad: _gamepad, ...rest } = valid.probes
    const errors = validateProbeRecord({ ...valid, probes: { ...rest, haptics: { status: 'available', note: 'x' } } })
    expect(errors).toContain('probes.gamepad is missing')
    expect(errors).toContain('probes.haptics is not a known probe')
  })

  test('rejects things that are not records', () => {
    expect(validateProbeRecord(null)).toEqual(['record is not an object'])
    expect(validateProbeRecord([])).toEqual(['record is not an object'])
  })
})

describe('renderInteractiveCapabilities', () => {
  const craft = buildProbeRecord(payload(), facts)
  const safari: InteractiveProbeRecord = { ...craft, host: { kind: 'browser', name: 'Safari', version: '27.0', userAgent: 'x' } }

  test('puts Craft first, then browsers', () => {
    expect(orderRecords([safari, craft]).map(record => record.host.kind)).toEqual(['craft', 'browser'])
  })

  test('is deterministic and carries what makes a column stale', () => {
    const rendered = renderInteractiveCapabilities([safari, craft])
    expect(rendered).toBe(renderInteractiveCapabilities([craft, safari]))
    expect(rendered.startsWith(INTERACTIVE_BEGIN)).toBe(true)
    expect(rendered.endsWith(INTERACTIVE_END)).toBe(true)
    expect(rendered).toContain('| Probe | Craft 0.0.105 | Safari 27.0 |')
    expect(rendered).toContain('| Measured at | 2026-10-02 | 2026-10-02 |')
    expect(rendered).toContain('macOS 27.0 arm64, Apple M3 Pro (Mac15,6)')
    for (const [, label] of PROBE_NAMES)
      expect(rendered).toContain(`| ${label} |`)
  })

  test('states what is out of scope', () => {
    expect(renderInteractiveCapabilities([craft])).toContain('Stacks is not shipping a game engine, a physics engine, an audio mixer or')
    expect(renderInteractiveCapabilities([])).toContain('No measurement has been recorded yet')
  })

  test('uses no em or en dashes', () => {
    // The repository's rule for user-visible text, and these notes are published.
    expect(renderInteractiveCapabilities([craft, safari])).not.toMatch(/[–—]/)
  })
})

describe('the checked-in records', () => {
  const records = loadProbeRecords()

  test('are all valid, and named after what they describe', () => {
    // loadProbeRecords throws naming the file on the first invalid one.
    const files = readdirSync(PROBE_RESULTS_DIR).filter(file => file.endsWith('.json')).sort()
    expect(files.length).toBe(records.length)
    records.forEach((record, i) => expect(probeRecordFileName(record)).toBe(files[i]))
  })

  test('include a measurement taken in a real Craft window', () => {
    const craft = records.filter(record => record.host.kind === 'craft')
    expect(craft.length).toBeGreaterThan(0)
    for (const record of craft)
      expect(record.host.version).toMatch(/^\d+\.\d+\.\d+/)
  })

  test('the published page matches them', () => {
    // `buddy docs:capabilities` writes this block and `docs:capabilities:check`
    // fails CI on drift; this catches it in the package's own tests too, and
    // names the fix.
    const published = readFileSync(capabilitiesPage, 'utf8')
    const start = published.indexOf(INTERACTIVE_BEGIN)
    const end = published.indexOf(INTERACTIVE_END)
    expect(start).toBeGreaterThan(-1)
    expect(published.slice(start, end + INTERACTIVE_END.length)).toBe(renderInteractiveCapabilities(records))
  })
})
