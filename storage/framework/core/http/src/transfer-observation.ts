import type { HttpAttemptObservation, HttpOriginOmission, HttpResponseObservation, HttpTransferObserver } from './index'

export type HttpTransferReason = 'complete' | 'total-deadline' | 'idle' | 'transport' | 'http-status' | 'checksum' | 'unknown'

export interface HttpTransferBucket {
  readonly fromMs: number
  readonly throughMs: number | null
  readonly bytes: number
  readonly chunks: number
}

export interface HttpTransferReport {
  readonly reason: HttpTransferReason
  readonly attempt: Readonly<HttpAttemptObservation> | null
  readonly response: Readonly<HttpResponseObservation> | null
  readonly bytesReceived: number
  readonly chunksReceived: number
  readonly headersElapsedMs: number | null
  readonly firstByteElapsedMs: number | null
  readonly lastByteElapsedMs: number | null
  readonly elapsedMs: number
  readonly lastByteAgeMs: number | null
  readonly maxInterChunkGapMs: number
  readonly buckets: readonly Readonly<HttpTransferBucket>[]
  readonly coalesced: boolean
  readonly overflowed: boolean
  readonly invalidObservation: boolean
}

export interface HttpTransferObservation {
  readonly observer: Readonly<HttpTransferObserver>
  readonly received: (byteLength: number) => void
  readonly finish: (reason: HttpTransferReason) => Readonly<HttpTransferReport>
}

/** Records caller-owned reads. It performs no I/O, retries or scheduling. */
export function createHttpTransferObservation(): Readonly<HttpTransferObservation> {
  let invalidObservation = false
  let overflowed = false
  let coalesced = false
  let start: number | null = null
  try {
    const value = performance.now()
    if (Number.isFinite(value)) start = value
    else invalidObservation = true
  }
  catch { invalidObservation = true }
  let elapsed = 0
  let attempt: Readonly<HttpAttemptObservation> | null = null
  let response: Readonly<HttpResponseObservation> | null = null
  let bytesReceived = 0
  let chunksReceived = 0
  let headersElapsedMs: number | null = null
  let firstByteElapsedMs: number | null = null
  let lastByteElapsedMs: number | null = null
  let maxInterChunkGapMs = 0
  let terminal: Readonly<HttpTransferReport> | undefined
  const buckets = Array.from({ length: 12 }, (_, index) => ({ fromMs: index * 10000, throughMs: null as number | null, bytes: 0, chunks: 0 }))

  const now = (): number => {
    try {
      const value = start === null ? Number.NaN : performance.now() - start
      if (!Number.isFinite(value) || value < elapsed) invalidObservation = true
      else if (value > Number.MAX_SAFE_INTEGER) { elapsed = Number.MAX_SAFE_INTEGER; overflowed = true }
      else elapsed = value
    }
    catch { invalidObservation = true }
    return elapsed
  }
  const add = (current: number, incoming: number): number => {
    if (incoming > Number.MAX_SAFE_INTEGER - current) {
      overflowed = true
      return Number.MAX_SAFE_INTEGER
    }
    return current + incoming
  }
  const validAttempt = (value: number): boolean => Number.isSafeInteger(value) && value >= 1
  const validOrigin = (origin: string | null, omitted: HttpOriginOmission): boolean => {
    if (!['invalid', 'oversized', 'unsupported', null].includes(omitted)) return false
    if (origin === null) return omitted !== null
    if (typeof origin !== 'string' || origin.length > 512 || omitted !== null) return false
    const parsed = new URL(origin)
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && parsed.origin === origin
  }
  const observer: Readonly<HttpTransferObserver> = Object.freeze({
    onAttempt(value: Readonly<HttpAttemptObservation>): void {
      if (terminal) return
      try {
        const { attempt: number, requestedOrigin, originOmitted } = value
        if (!validAttempt(number) || !validOrigin(requestedOrigin, originOmitted)) { invalidObservation = true; return }
        now()
        attempt = Object.freeze({ attempt: number, requestedOrigin, originOmitted })
      }
      catch { invalidObservation = true }
    },
    onResponse(value: Readonly<HttpResponseObservation>): void {
      if (terminal) return
      try {
        const { attempt: number, responseOrigin, originOmitted, status, contentLength } = value
        if (!validAttempt(number) || !validOrigin(responseOrigin, originOmitted)
          || !Number.isInteger(status) || status < 0 || status > 599
          || (contentLength !== null && (!Number.isSafeInteger(contentLength) || contentLength < 0))) { invalidObservation = true; return }
        headersElapsedMs = now()
        response = Object.freeze({ attempt: number, responseOrigin, originOmitted, status, contentLength })
      }
      catch { invalidObservation = true }
    },
  })
  const received = (byteLength: number): void => {
    if (terminal) return
    if (!Number.isSafeInteger(byteLength) || byteLength < 1) { invalidObservation = true; return }
    const time = now()
    if (firstByteElapsedMs === null) firstByteElapsedMs = time
    if (lastByteElapsedMs !== null) maxInterChunkGapMs = Math.max(maxInterChunkGapMs, time - lastByteElapsedMs)
    lastByteElapsedMs = time
    bytesReceived = add(bytesReceived, byteLength)
    chunksReceived = add(chunksReceived, 1)
    if (time >= 120000) coalesced = true
    const bucket = buckets[Math.min(Math.floor(time / 10000), 11)]!
    bucket.throughMs = time
    bucket.bytes = add(bucket.bytes, byteLength)
    bucket.chunks = add(bucket.chunks, 1)
  }
  const finish = (reason: HttpTransferReason): Readonly<HttpTransferReport> => {
    if (terminal) return terminal
    if (!['complete', 'total-deadline', 'idle', 'transport', 'http-status', 'checksum', 'unknown'].includes(reason)) {
      invalidObservation = true
      reason = 'unknown'
    }
    const time = now()
    terminal = Object.freeze({
      reason, attempt, response, bytesReceived, chunksReceived, headersElapsedMs, firstByteElapsedMs, lastByteElapsedMs,
      elapsedMs: time,
      lastByteAgeMs: lastByteElapsedMs === null ? null : time - lastByteElapsedMs,
      maxInterChunkGapMs,
      buckets: Object.freeze(buckets.map(bucket => Object.freeze({ ...bucket }))),
      coalesced, overflowed, invalidObservation,
    })
    return terminal
  }
  return Object.freeze({ observer, received, finish })
}
