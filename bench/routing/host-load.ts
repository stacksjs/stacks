import process from 'node:process'

export const BUSY_PROCESS_CPU_PERCENT = 75

export interface BusyProcess {
  pid: number
  cpuPercent: number
  command: string
}

export function parseProcessCpu(output: string, ownPid = process.pid): BusyProcess[] {
  const processes: BusyProcess[] = []
  for (const line of output.split('\n')) {
    const match = /^\s*(\d+)\s+([\d.]+)\s+(.+?)\s*$/.exec(line)
    if (!match)
      continue
    const pid = Number(match[1])
    const cpuPercent = Number(match[2])
    if (pid === ownPid || !Number.isFinite(cpuPercent) || cpuPercent < BUSY_PROCESS_CPU_PERCENT)
      continue
    processes.push({ pid, cpuPercent, command: match[3]! })
  }
  return processes.sort((a, b) => b.cpuPercent - a.cpuPercent)
}

/** Best-effort preflight. Unsupported hosts return no readings. */
export async function detectBusyProcesses(): Promise<BusyProcess[]> {
  try {
    const child = Bun.spawn(['ps', '-A', '-o', 'pid=,%cpu=,comm='], {
      stdout: 'pipe',
      stderr: 'ignore',
    })
    const [output, exitCode] = await Promise.all([
      new Response(child.stdout).text(),
      child.exited,
    ])
    return exitCode === 0 ? parseProcessCpu(output) : []
  }
  catch {
    return []
  }
}

export async function checkHostLoad(allowBusyHost: boolean, observed: Map<number, BusyProcess>): Promise<void> {
  const active = await detectBusyProcesses()
  if (active.length > 0 && !allowBusyHost) {
    throw new Error(`Host is busy: ${active.map(formatBusyProcess).join(', ')}. Stop competing work or pass --allow-busy-host for a direction-only run.`)
  }
  for (const process of active)
    observed.set(process.pid, process)
}

export function formatBusyProcess(process: BusyProcess): string {
  return `${process.command} (PID ${process.pid}, ${process.cpuPercent.toFixed(1)}% CPU)`
}
