import type { ProbeResult, ProbeTarget, Verdict } from '../src/commands/integrations-probe'
import { describe, expect, it } from 'bun:test'
import {
  classifyStatus,
  concludeProbe,
  exitCodeFor,
  PROBE_CONTROLS,
  PROBE_TARGETS,
  renderReport,
} from '../src/commands/integrations-probe'

/**
 * The decision logic behind `buddy integrations:probe` (stacksjs/stacks#2859).
 *
 * Offline on purpose. The command's value is in what it concludes from a set of
 * statuses, and a test that reached the network would be slow, flaky, and would
 * stop testing the thing that can actually be wrong. The statuses the real
 * endpoints answer were measured when the targets were added and are recorded
 * on each one; the three live paths through the command were exercised against
 * the real network before it shipped.
 */

/**
 * A result whose target was observed answering exactly this, so nothing in it
 * reads as having moved. A moved status is built explicitly where it is the
 * thing under test.
 */
function resultOf(status: number | null, name = 'x'): ProbeResult {
  const target: ProbeTarget = { name, url: `https://example.com/${name}`, method: 'GET', observed: status ?? 401 }
  return { target, status, verdict: classifyStatus(status) }
}

const GONE = [resultOf(404, 'control')]

describe('classifyStatus', () => {
  it('reads 404 and 410 as gone, which is the signal this exists for', () => {
    // The decommissioned FCM endpoint answers 404 where its replacement
    // answers 401 (#2856). That difference is the whole method.
    expect(classifyStatus(404)).toBe('gone')
    expect(classifyStatus(410)).toBe('gone')
  })

  it('reads an auth rejection as proof the route is there', () => {
    // Only a route that exists can check a credential, so the absence of one
    // is what makes an unauthenticated probe readable.
    expect(classifyStatus(401)).toBe('alive')
    expect(classifyStatus(403)).toBe('alive')
  })

  it('reads a complaint about the request as alive too', () => {
    // Several targets are deliberately incomplete requests. Being told the body
    // is wrong means something read it.
    expect(classifyStatus(400)).toBe('alive')
    expect(classifyStatus(422)).toBe('alive')
    expect(classifyStatus(429)).toBe('alive')
    expect(classifyStatus(200)).toBe('alive')
    expect(classifyStatus(301)).toBe('alive')
  })

  it('refuses to read a provider outage as a sunset', () => {
    for (const status of [500, 502, 503, 504])
      expect(classifyStatus(status), String(status)).toBe('inconclusive')
  })

  it('refuses to read silence as a sunset', () => {
    // A timeout, a DNS failure, a reset connection. Treating these as death is
    // how a scheduled check earns itself a mute button.
    expect(classifyStatus(null)).toBe('inconclusive')
  })
})

describe('concludeProbe', () => {
  it('calls a run untrustworthy when a control does not read as gone', () => {
    // A captive portal, a corporate proxy or an interception appliance can
    // answer for every URL on earth, under which every target reads as alive.
    const conclusion = concludeProbe([resultOf(401)], [resultOf(200, 'control')])

    expect(conclusion).toBe('untrustworthy')
  })

  it('calls a run with no controls untrustworthy rather than clean', () => {
    // An empty control set would otherwise make every target vacuously fine,
    // which is the failure this whole mechanism is guarding against.
    expect(concludeProbe([resultOf(401)], [])).toBe('untrustworthy')
  })

  it('reads the controls before the targets', () => {
    // A withdrawn endpoint found by an untrustworthy run is not a finding, so
    // the controls win even when a target looks gone.
    expect(concludeProbe([resultOf(404)], [resultOf(200, 'control')])).toBe('untrustworthy')
  })

  it('reports a withdrawn endpoint once the controls are sound', () => {
    expect(concludeProbe([resultOf(401), resultOf(404)], GONE)).toBe('withdrawn')
  })

  it('prefers a withdrawal to an unanswered target', () => {
    // Both present: the withdrawal is the one worth waking someone for.
    expect(concludeProbe([resultOf(null), resultOf(404)], GONE)).toBe('withdrawn')
  })

  it('says so when a target simply did not answer', () => {
    expect(concludeProbe([resultOf(401), resultOf(null)], GONE)).toBe('inconclusive')
  })

  it('is clean only when every target answered and none was gone', () => {
    expect(concludeProbe([resultOf(401), resultOf(200), resultOf(422)], GONE)).toBe('ok')
  })
})

describe('exitCodeFor', () => {
  it('fails only for a withdrawal, so an outage cannot open an issue', () => {
    expect(exitCodeFor('withdrawn')).toBe(1)
    expect(exitCodeFor('ok')).toBe(0)
    // Distinct from both: worth surfacing, not worth alarming.
    expect(exitCodeFor('inconclusive')).toBe(2)
    expect(exitCodeFor('untrustworthy')).toBe(2)
  })
})

describe('renderReport', () => {
  it('says when a status moved, so a change is legible even when still alive', () => {
    const target: ProbeTarget = { name: 'Example', url: 'https://example.com/v1', method: 'GET', observed: 401 }
    const report = renderReport([{ target, status: 403, verdict: 'alive' }], GONE, 'ok')

    expect(report).toContain('403 (was 401)')
  })

  it('does not nag when the status is the one recorded', () => {
    const target: ProbeTarget = { name: 'Example', url: 'https://example.com/v1', method: 'GET', observed: 401 }
    const report = renderReport([{ target, status: 401, verdict: 'alive' }], GONE, 'ok')

    expect(report).not.toContain('(was')
  })

  it('states the conclusion rather than leaving a reader to total the table', () => {
    const headlines: Array<[Parameters<typeof renderReport>[2], string]> = [
      ['withdrawn', 'has been withdrawn'],
      ['untrustworthy', 'proves nothing'],
      ['inconclusive', 'No conclusion'],
      ['ok', 'still answering'],
    ]
    for (const [conclusion, expected] of headlines)
      expect(renderReport([resultOf(401)], GONE, conclusion), conclusion).toContain(expected)
  })
})

describe('the probe registry', () => {
  const all = [...PROBE_TARGETS, ...PROBE_CONTROLS]

  it('probes something', () => {
    expect(PROBE_TARGETS.length).toBeGreaterThan(10)
    expect(PROBE_CONTROLS.length).toBeGreaterThan(2)
  })

  it('sends every request over https', () => {
    expect(all.filter(target => !target.url.startsWith('https://')).map(target => target.name)).toEqual([])
  })

  it('puts nothing credential-shaped in a URL', () => {
    // No probe needs a secret, and a URL is the one place a secret must never
    // go: it reaches logs, proxies and the provider's own access records.
    const suspicious = all.filter(target => /key|token|secret|password|auth|credential|[?&]sig/i.test(target.url))

    expect(suspicious.map(target => target.url)).toEqual([])
  })

  it('records the status each target was observed to answer', () => {
    // An `observed` of 404 on a live target would mean it was added from a
    // guess rather than a measurement, and would read as gone on every run.
    for (const target of PROBE_TARGETS) {
      expect(classifyStatus(target.observed), target.name).toBe('alive' satisfies Verdict)
    }
  })

  it('records every control as one that was observed to be gone', () => {
    for (const control of PROBE_CONTROLS)
      expect(classifyStatus(control.observed), control.name).toBe('gone' satisfies Verdict)
  })

  it('spreads the controls across hosts, so one provider cannot silence them', () => {
    const hosts = new Set(PROBE_CONTROLS.map(control => new URL(control.url).host))

    expect(hosts.size).toBeGreaterThan(1)
  })

  it('probes each URL once', () => {
    const urls = all.map(target => target.url)

    expect(urls.length).toBe(new Set(urls).size)
  })
})
