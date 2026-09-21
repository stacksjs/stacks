import type { Driver, LoadRequest, LoadResult } from './drivers'
import { platform } from 'node:os'
import { readProcProcessCpuTime } from './host-load'

/**
 * CPU time the server actually burned, as a percentage of one core.
 *
 * Deltas of cumulative CPU time, not `ps -o %cpu`: on macOS that column is an
 * average over the process's whole lifetime, so a server that just booted
 * reports its own startup mixed into every reading and a long run reports a
 * number that keeps sliding. Two samples and the wall clock between them
 * answer the question the report is actually asking - "was that throughput won
 * by being efficient, or by using more CPU".
 */
export type CpuSampleSource = 'proc' | 'ps'
export type CpuWindowSource = CpuSampleSource | 'mixed'

export interface ProcessCpuSample {
  seconds: number
  source: CpuSampleSource
}

async function psCpuSample(pid: number): Promise<ProcessCpuSample | null> {
  try {
    const proc = Bun.spawn(['ps', '-o', 'time=', '-p', String(pid)], { stdout: 'pipe', stderr: 'ignore' })
    const out = (await new Response(proc.stdout).text()).trim()
    if (!out) return null
    // [days-][hours:]minutes:seconds[.fraction]. Days have 24 hours,
    // so folding every separator in base 60 inflates a day-boundary delta.
    const match = /^(?:(\d+)-)?(?:(\d+):)?(\d+):(\d+(?:\.\d+)?)$/.exec(out)
    if (!match) return null
    const seconds = Number(match[1] ?? 0) * 86400
      + Number(match[2] ?? 0) * 3600
      + Number(match[3]) * 60 + Number(match[4])
    return Number.isFinite(seconds) ? { seconds, source: 'ps' } : null
  }
  catch {
    return null
  }
}

/**
 * Cumulative server CPU time from the most precise source on this host.
 *
 * Linux `ps -o time=` is whole-second data. At 10,000 req/s over 30 seconds,
 * one tick becomes 3.33 us/request and makes a single rounding step look like
 * 12-20% instability. `/proc/<pid>/stat` uses the host's `_SC_CLK_TCK` rate,
 * reducing the same cost resolution to about 0.033 us/request at 100 Hz.
 * Other hosts and restricted Linux environments retain the portable `ps`
 * fallback.
 */
export async function processCpuSample(
  pid: number,
  currentPlatform = platform(),
  procRoot = '/proc',
  clockTicksPerSecond?: number | null,
): Promise<ProcessCpuSample | null> {
  if (currentPlatform === 'linux') {
    const sample = await readProcProcessCpuTime(pid, procRoot, clockTicksPerSecond)
    if (sample)
      return { seconds: sample.seconds, source: 'proc' }
  }
  return psCpuSample(pid)
}

export async function processCpuSeconds(
  pid: number,
  currentPlatform = platform(),
  procRoot = '/proc',
  clockTicksPerSecond?: number | null,
): Promise<number | null> {
  return (await processCpuSample(pid, currentPlatform, procRoot, clockTicksPerSecond))?.seconds ?? null
}

export interface CpuWindow {
  /** CPU seconds the server burned during the measured load. */
  cpuSeconds: number | null
  /** Those seconds as a percentage of one core over the window's wall clock. */
  cpuPercent: number | null
  /** Sampling source at both boundaries, or mixed when the fallback changed. */
  cpuSource: CpuWindowSource | null
}

export function calculateCpuWindow(
  before: ProcessCpuSample | null,
  after: ProcessCpuSample | null,
  wallSeconds: number,
): CpuWindow {
  if (before == null || after == null || wallSeconds <= 0)
    return { cpuSeconds: null, cpuPercent: null, cpuSource: null }
  const used = after.seconds - before.seconds
  const cpuSource: CpuWindowSource = before.source === after.source ? before.source : 'mixed'
  return { cpuSeconds: used, cpuPercent: (used / wallSeconds) * 100, cpuSource }
}

async function measureCpu(pid: number, clockTicksPerSecond?: number | null): Promise<() => Promise<CpuWindow>> {
  const before = await processCpuSample(pid, platform(), '/proc', clockTicksPerSecond)
  const wallStart = performance.now()
  return async () => {
    const after = await processCpuSample(pid, platform(), '/proc', clockTicksPerSecond)
    const wallSeconds = (performance.now() - wallStart) / 1000
    return calculateCpuWindow(before, after, wallSeconds)
  }
}

/** Sample server CPU over the load window returned by the driver. */
export async function measureLoad(driver: Driver, request: LoadRequest, pid: number, clockTicksPerSecond?: number | null): Promise<{ result: LoadResult, cpuSeconds: number | null, cpuPercent: number | null, cpuSource: CpuWindowSource | null, warmupResult: LoadResult | null }> {
  // Warm the server before taking either CPU sample. Every adapter receives
  // zero internal warmup, so throughput and CPU exclude the same phase.
  const measuredRequest = { ...request, warmupSeconds: 0 }
  const warmupResult = request.warmupSeconds > 0
    ? await driver.run({ ...measuredRequest, durationSeconds: request.warmupSeconds })
    : null
  const finishCpu = await measureCpu(pid, clockTicksPerSecond)
  const result = await driver.run(measuredRequest)
  const cpu = await finishCpu()
  return { result, cpuSeconds: cpu.cpuSeconds, cpuPercent: cpu.cpuPercent, cpuSource: cpu.cpuSource, warmupResult }
}

/**
 * Microseconds of server CPU per request served.
 *
 * The same CPU window divided by the work it covers rather than by the wall
 * clock. At a fixed request rate every target answers the same number of
 * requests, so this is a direct comparison of how much work each one does -
 * and unlike saturating throughput it barely moves when the host is busy,
 * because a competing process lengthens the wall clock without adding to the
 * server's own CPU accounting.
 *
 * The window includes the load generator's startup and drain, so the absolute
 * figure carries a fixed overhead shared by every target measured the same
 * way. Compare rows within a run; do not read a row as the framework's own
 * per-request cost in isolation.
 */
export function cpuMicrosPerRequest(cpuSeconds: number | null, requests: number): number | null {
  if (cpuSeconds == null || !Number.isFinite(cpuSeconds) || cpuSeconds < 0)
    return null
  if (!Number.isFinite(requests) || requests <= 0)
    return null
  return (cpuSeconds * 1e6) / requests
}
