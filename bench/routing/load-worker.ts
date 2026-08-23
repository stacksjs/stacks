/**
 * One process's share of the built-in load generator.
 *
 * Reads its spec as a single JSON argv entry, drives `connections` request
 * loops until the deadline, and prints one JSON line on stdout. Everything it
 * measures starts after the warm-up window, so a JIT that has not settled and
 * a connection pool that has not filled never reach the numbers.
 */

import process from 'node:process'

interface Spec {
  url: string
  method: 'GET' | 'POST'
  body: string | null
  headers: Record<string, string>
  connections: number
  warmupMs: number
  durationMs: number
}

const spec: Spec = JSON.parse(process.argv[2]!)

/** Reservoir size. Enough for a stable p99, small enough to stay in cache. */
const SAMPLE_MAX = 20_000

const samples = new Float64Array(SAMPLE_MAX)
let sampleCount = 0
let seen = 0

function record(ms: number): void {
  if (sampleCount < SAMPLE_MAX) {
    samples[sampleCount++] = ms
  }
  else {
    // Reservoir sampling keeps the retained set uniform over the whole run
    // instead of over its first few seconds.
    const idx = Math.floor(Math.random() * (seen + 1))
    if (idx < SAMPLE_MAX) samples[idx] = ms
  }
  seen++
}

const start = performance.now()
const measureFrom = start + spec.warmupMs
const deadline = measureFrom + spec.durationMs

let requests = 0
let errors = 0
const perSecond: number[] = []

const init: RequestInit = {
  method: spec.method,
  headers: spec.headers,
  ...(spec.body != null ? { body: spec.body } : {}),
}

async function loop(): Promise<void> {
  for (;;) {
    const t0 = performance.now()
    if (t0 >= deadline) return

    let failed = false
    try {
      const res = await fetch(spec.url, init)
      // Drain the body: an undrained response holds the connection and turns
      // the run into a measurement of Bun's socket cleanup.
      await res.arrayBuffer()
      if (res.status >= 400) failed = true
    }
    catch {
      failed = true
    }

    const t1 = performance.now()
    if (t1 >= measureFrom) {
      requests++
      if (failed) errors++
      record(t1 - t0)
      const bucket = Math.floor((t1 - measureFrom) / 1000)
      perSecond[bucket] = (perSecond[bucket] ?? 0) + 1
    }
  }
}

await Promise.all(Array.from({ length: spec.connections }, () => loop()))

for (let i = 0; i < perSecond.length; i++) {
  if (perSecond[i] === undefined) perSecond[i] = 0
}

console.log(JSON.stringify({
  requests,
  errors,
  perSecond,
  samples: Array.from(samples.subarray(0, sampleCount)),
}))
