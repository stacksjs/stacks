/**
 * Load-generator adapters.
 *
 * `oha` and `bombardier` are the ones whose numbers are fit to publish: both
 * are native, both report percentiles, both cost almost nothing per request.
 * `autocannon` is the JS-native fallback. `builtin` is a Bun implementation
 * that ships with this harness so the suite runs on a clean checkout with
 * nothing installed — it is fine for "did that change help", and its output is
 * labelled `direction-only` everywhere it appears, because a generator written
 * in the same runtime as the server under test competes with it for the very
 * thing being measured.
 *
 * Every adapter returns the same shape, so the runner and the report never
 * learn which tool produced a row.
 */

import process from 'node:process'
import { fileURLToPath } from 'node:url'

export interface LoadRequest {
  url: string
  method: 'GET' | 'POST'
  body?: string
  headers: Record<string, string>
  connections: number
  /** Discarded, not measured. */
  warmupSeconds: number
  durationSeconds: number
}

export interface LoadResult {
  /** Requests per second over the measured window. */
  rpsMean: number
  /** Median of the per-second request counts. `null` when the tool omits it. */
  rpsP50: number | null
  latencyMs: { p50: number, p90: number, p99: number }
  requests: number
  errors: number
  /** Raw stdout from the tool, committed alongside the report. */
  raw: string
}

export interface Driver {
  name: string
  /** Whether numbers from this driver may be published. */
  publishable: boolean
  isAvailable: () => Promise<boolean>
  run: (req: LoadRequest) => Promise<LoadResult>
}

async function which(bin: string): Promise<boolean> {
  const proc = Bun.spawn(['sh', '-c', `command -v ${bin}`], { stdout: 'ignore', stderr: 'ignore' })
  return (await proc.exited) === 0
}

async function capture(cmd: string[], env?: Record<string, string>): Promise<string> {
  const proc = Bun.spawn(cmd, {
    stdout: 'pipe',
    stderr: 'pipe',
    env: { ...process.env, ...env } as Record<string, string>,
  })
  const [out, err, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])
  if (code !== 0)
    throw new Error(`${cmd[0]} exited ${code}: ${err.trim() || out.trim()}`)
  return out
}

function methodArgs(req: LoadRequest, methodFlag: string, bodyFlag: string, headerFlag: string): string[] {
  const args: string[] = []
  if (req.method !== 'GET') {
    args.push(methodFlag, req.method)
    if (req.body != null) args.push(bodyFlag, req.body)
  }
  for (const [name, value] of Object.entries(req.headers))
    args.push(headerFlag, `${name}: ${value}`)
  return args
}

/** `oha` — the preferred tool. Percentiles come straight out of its JSON. */
const oha: Driver = {
  name: 'oha',
  publishable: true,
  isAvailable: () => which('oha'),
  async run(req) {
    // oha has no warm-up flag, so the warm-up is a separate throwaway run.
    if (req.warmupSeconds > 0) {
      await capture(['oha', '-z', `${req.warmupSeconds}s`, '-c', String(req.connections), '--no-tui', '-j', ...methodArgs(req, '-m', '-d', '-H'), req.url])
    }
    const raw = await capture(['oha', '-z', `${req.durationSeconds}s`, '-c', String(req.connections), '--no-tui', '-j', ...methodArgs(req, '-m', '-d', '-H'), req.url])
    const json = JSON.parse(raw)
    const codes: Record<string, number> = json.statusCodeDistribution ?? {}
    let ok = 0
    let bad = 0
    for (const [code, count] of Object.entries(codes)) {
      if (Number(code) >= 200 && Number(code) < 400) ok += count
      else bad += count
    }
    return {
      rpsMean: json.summary.requestsPerSec,
      rpsP50: json.rps?.percentiles?.['p50'] ?? null,
      latencyMs: {
        p50: (json.latencyPercentiles?.p50 ?? 0) * 1000,
        p90: (json.latencyPercentiles?.p90 ?? 0) * 1000,
        p99: (json.latencyPercentiles?.p99 ?? 0) * 1000,
      },
      requests: ok + bad,
      errors: bad + (json.errorDistribution ? Object.values(json.errorDistribution as Record<string, number>).reduce((a, b) => a + b, 0) : 0),
      raw,
    }
  },
}

/** `bombardier` — latencies in microseconds. */
const bombardier: Driver = {
  name: 'bombardier',
  publishable: true,
  isAvailable: () => which('bombardier'),
  async run(req) {
    if (req.warmupSeconds > 0)
      await capture(['bombardier', '-d', `${req.warmupSeconds}s`, '-c', String(req.connections), '-o', 'json', ...methodArgs(req, '-m', '-b', '-H'), req.url])
    const raw = await capture(['bombardier', '-d', `${req.durationSeconds}s`, '-c', String(req.connections), '-o', 'json', '-l', ...methodArgs(req, '-m', '-b', '-H'), req.url])
    const json = JSON.parse(raw)
    const r = json.result
    const ok = (r.req2xx ?? 0) + (r.req3xx ?? 0)
    const bad = (r.req1xx ?? 0) + (r.req4xx ?? 0) + (r.req5xx ?? 0) + (r.others ?? 0)
    const pct = r.latency?.percentiles ?? {}
    return {
      rpsMean: r.rps?.mean ?? 0,
      rpsP50: r.rps?.percentiles?.['50'] ?? null,
      latencyMs: {
        p50: (pct['50'] ?? 0) / 1000,
        p90: (pct['90'] ?? 0) / 1000,
        p99: (pct['99'] ?? 0) / 1000,
      },
      requests: ok + bad,
      errors: bad,
      raw,
    }
  },
}

/** `autocannon` — the JS-native fallback. Latencies already in ms. */
const autocannon: Driver = {
  name: 'autocannon',
  publishable: true,
  isAvailable: () => which('autocannon'),
  async run(req) {
    const args = ['autocannon', '-d', String(req.durationSeconds), '-w', String(req.warmupSeconds), '-c', String(req.connections), '-j']
    if (req.method !== 'GET') {
      args.push('-m', req.method)
      if (req.body != null) args.push('-b', req.body)
    }
    for (const [name, value] of Object.entries(req.headers))
      args.push('-H', `${name}: ${value}`)
    args.push(req.url)
    const raw = await capture(args)
    const json = JSON.parse(raw)
    return {
      rpsMean: json.requests?.average ?? 0,
      rpsP50: json.requests?.p50 ?? null,
      latencyMs: {
        p50: json.latency?.p50 ?? 0,
        p90: json.latency?.p90 ?? 0,
        p99: json.latency?.p99 ?? 0,
      },
      requests: json.requests?.total ?? 0,
      errors: (json.errors ?? 0) + (json.non2xx ?? 0),
      raw,
    }
  },
}

const WORKER = fileURLToPath(new URL('./load-worker.ts', import.meta.url))

/**
 * The zero-install fallback: N Bun subprocesses, each driving a share of the
 * connections. Split across processes rather than run in one, because a single
 * Bun process is one thread and would cap the generator well below the server.
 * Still the weakest of the four — see the note at the top of this file.
 */
const builtin: Driver = {
  name: 'builtin',
  publishable: false,
  isAvailable: async () => true,
  async run(req) {
    const workers = Math.max(1, Math.min(req.connections, Math.max(1, (navigator.hardwareConcurrency || 4) - 2)))
    const per = Math.max(1, Math.floor(req.connections / workers))

    const results = await Promise.all(
      Array.from({ length: workers }, (_, i) => {
        const spec = JSON.stringify({
          url: req.url,
          method: req.method,
          body: req.body ?? null,
          headers: req.headers,
          connections: i === workers - 1 ? req.connections - per * (workers - 1) : per,
          warmupMs: req.warmupSeconds * 1000,
          durationMs: req.durationSeconds * 1000,
        })
        return capture(['bun', WORKER, spec]).then(text => JSON.parse(text.trim().split('\n').pop()!))
      }),
    )

    const latencies: number[] = results.flatMap(r => r.samples as number[])
    latencies.sort((a, b) => a - b)
    const pick = (q: number) => latencies.length === 0 ? 0 : latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * q))]!

    const seconds = Math.max(...results.map(r => (r.perSecond as number[]).length))
    const perSecond = Array.from({ length: seconds }, (_, i) =>
      results.reduce((sum, r) => sum + ((r.perSecond as number[])[i] ?? 0), 0))
    // Drop the trailing partial second — it always reads as a throughput
    // collapse and drags the median down for no reason.
    const whole = perSecond.slice(0, -1)
    const sorted = [...whole].sort((a, b) => a - b)

    const requests = results.reduce((sum, r) => sum + (r.requests as number), 0)
    const errors = results.reduce((sum, r) => sum + (r.errors as number), 0)

    return {
      rpsMean: requests / req.durationSeconds,
      rpsP50: sorted.length ? sorted[Math.floor(sorted.length / 2)]! : null,
      latencyMs: { p50: pick(0.5), p90: pick(0.9), p99: pick(0.99) },
      requests,
      errors,
      raw: JSON.stringify({ workers, perSecond, requests, errors }, null, 2),
    }
  },
}

export const DRIVERS: readonly Driver[] = [oha, bombardier, autocannon, builtin]

/** First available driver, preferring the publishable native ones. */
export async function pickDriver(preferred?: string): Promise<Driver> {
  if (preferred) {
    const named = DRIVERS.find(d => d.name === preferred)
    if (!named)
      throw new Error(`Unknown load driver '${preferred}'. Known: ${DRIVERS.map(d => d.name).join(', ')}`)
    if (!(await named.isAvailable()))
      throw new Error(`Load driver '${preferred}' is not installed`)
    return named
  }
  for (const driver of DRIVERS) {
    if (await driver.isAvailable())
      return driver
  }
  throw new Error('No load driver available')
}
