import type { Driver, LoadRequest, LoadResult } from './drivers'

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
async function cpuSeconds(pid: number): Promise<number | null> {
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
    return Number.isFinite(seconds) ? seconds : null
  }
  catch {
    return null
  }
}

async function measureCpu(pid: number): Promise<() => Promise<number | null>> {
  const before = await cpuSeconds(pid)
  const wallStart = performance.now()
  return async () => {
    const after = await cpuSeconds(pid)
    const wallSeconds = (performance.now() - wallStart) / 1000
    if (before == null || after == null || wallSeconds <= 0) return null
    return ((after - before) / wallSeconds) * 100
  }
}

/** Sample server CPU over the load window returned by the driver. */
export async function measureLoad(driver: Driver, request: LoadRequest, pid: number): Promise<{ result: LoadResult, cpuPercent: number | null, warmupResult: LoadResult | null }> {
  // Warm the server before taking either CPU sample. Every adapter receives
  // zero internal warmup, so throughput and CPU exclude the same phase.
  const measuredRequest = { ...request, warmupSeconds: 0 }
  const warmupResult = request.warmupSeconds > 0
    ? await driver.run({ ...measuredRequest, durationSeconds: request.warmupSeconds })
    : null
  const finishCpu = await measureCpu(pid)
  const result = await driver.run(measuredRequest)
  return { result, cpuPercent: await finishCpu(), warmupResult }
}
