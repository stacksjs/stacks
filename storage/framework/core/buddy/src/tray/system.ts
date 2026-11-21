import { cpus, freemem, totalmem } from 'node:os'

export function createCpuSampler(read = cpus) {
  const totals = () => read().reduce(({ idle, total }, { times }) => ({
    idle: idle + times.idle,
    total: total + times.user + times.nice + times.sys + times.idle + times.irq,
  }), { idle: 0, total: 0 })

  let previous = totals()
  let percent: number | null = null
  return () => {
    const next = totals()
    const elapsed = next.total - previous.total
    const idle = next.idle - previous.idle
    previous = next
    if (elapsed > 0)
      percent = Math.round(100 * Math.max(0, Math.min(1, (elapsed - idle) / elapsed)))
    return percent
  }
}

export function activeMemoryBytes(stats: string): number | undefined {
  const pageSize = Number(stats.match(/page size of (\d+) bytes/)?.[1])
  const active = Number(stats.match(/^Pages active:\s+(\d+)/m)?.[1])
  const wired = Number(stats.match(/^Pages wired down:\s+(\d+)/m)?.[1])
  const compressed = Number(stats.match(/^Pages occupied by compressor:\s+(\d+)/m)?.[1])
  const bytes = pageSize * (active + wired + compressed)
  return Number.isSafeInteger(bytes) && bytes >= 0 ? bytes : undefined
}

export function createSystemSampler() {
  const sampleCpu = createCpuSampler()
  return async () => {
    const cpu = sampleCpu()
    const total = totalmem()
    const command = Bun.spawn(['/usr/bin/vm_stat'], { stderr: 'ignore', stdout: 'pipe', timeout: 1500 })
    const [code, stats] = await Promise.all([command.exited, new Response(command.stdout).text()])
    const active = code === 0 ? activeMemoryBytes(stats) : undefined
    const used = Math.max(0, Math.min(total, active ?? total - freemem()))
    return { cpu, memory: { used, total, raw: active === undefined } }
  }
}
