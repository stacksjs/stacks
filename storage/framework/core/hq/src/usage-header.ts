import type { UsageState } from './types'

/** The response header an ingest endpoint answers with on every 2xx. */
export const USAGE_HEADER = 'X-HQ-Usage'

export interface UsageHeader {
  meter: string
  used: number
  /** `null` is an unlimited meter, written as `unlimited`. */
  limit: number | null
  state: UsageState
  /** The service's own upgrade page. */
  upgradeUrl: string | null
}

const STATES: ReadonlySet<string> = new Set(['ok', 'warn', 'over', 'sampled'])
const METER = /^[\w.:-]{1,64}$/

function wholeNumber(value: string): number | null {
  return /^\d{1,15}$/.test(value) ? Number(value) : null
}

/**
 * `meter;used;limit;state;upgrade=<url>`
 *
 * The URL is percent-encoded so a `;` or `,` inside it cannot be read as a
 * field or a second header value.
 */
export function formatUsageHeader(usage: UsageHeader): string {
  if (!METER.test(usage.meter))
    throw new TypeError(`Invalid meter name '${usage.meter}'.`)
  const used = Math.max(0, Math.floor(Number.isFinite(usage.used) ? usage.used : 0))
  const limit = usage.limit === null ? 'unlimited' : String(Math.max(0, Math.floor(usage.limit)))
  const fields = [usage.meter, String(used), limit, usage.state]
  if (usage.upgradeUrl)
    fields.push(`upgrade=${encodeURIComponent(usage.upgradeUrl)}`)
  return fields.join(';')
}

/**
 * Read an `X-HQ-Usage` value. Answers `null` for anything malformed: the
 * header is advice, and a reader must never fail a request over it.
 */
export function parseUsageHeader(value: string | null | undefined): UsageHeader | null {
  if (typeof value !== 'string' || value.length === 0 || value.length > 2048)
    return null
  const [meter, usedText, limitText, state, ...parameters] = value.trim().split(';').map(part => part.trim())
  if (!meter || !METER.test(meter) || usedText === undefined || limitText === undefined || !state || !STATES.has(state))
    return null
  const used = wholeNumber(usedText)
  const limit = limitText === 'unlimited' ? null : wholeNumber(limitText)
  if (used === null || (limit === null && limitText !== 'unlimited'))
    return null

  let upgradeUrl: string | null = null
  for (const parameter of parameters) {
    if (!parameter.startsWith('upgrade='))
      continue
    try {
      const url = decodeURIComponent(parameter.slice('upgrade='.length))
      if (/^https?:\/\//i.test(url))
        upgradeUrl = url
    }
    catch {
      return null
    }
  }
  return { meter, used, limit, state: state as UsageState, upgradeUrl }
}
