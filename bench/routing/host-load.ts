import { readdir, readFile } from 'node:fs/promises'
import { platform } from 'node:os'
import process from 'node:process'

export const BUSY_PROCESS_CPU_PERCENT = 75

/**
 * How long the two cumulative CPU readings are separated by.
 *
 * Long enough that the coarsest source of CPU time on either platform still
 * resolves a few percent of a core - Linux reports `/proc` CPU time in host
 * clock ticks and `ps` on Darwin reports hundredths of a second - and short
 * enough that the guard runs twice around every measurement without adding a
 * meaningful share of the suite's wall clock.
 */
export const HOST_LOAD_SAMPLE_MS = 400

let linuxClockTicksPromise: Promise<number | null> | undefined

export interface BusyProcess {
  pid: number
  cpuPercent: number
  command: string
}

/** One process's cumulative CPU time at a moment. */
export interface CpuTimeSample {
  seconds: number
  command: string
}

/**
 * `[dd-][hh:]mm:ss[.ff]`, the cumulative CPU time `ps` prints.
 *
 * A day has 24 hours, so folding every separator in base 60 would inflate a
 * reading that has crossed a day boundary.
 */
function parsePsCpuSeconds(value: string): number | null {
  const match = /^(?:(\d+)-)?(?:(\d+):)?(\d+):(\d+(?:\.\d+)?)$/.exec(value)
  if (!match)
    return null
  const seconds = Number(match[1] ?? 0) * 86400
    + Number(match[2] ?? 0) * 3600
    + Number(match[3]) * 60
    + Number(match[4])
  return Number.isFinite(seconds) ? seconds : null
}

/** Parse `ps -A -o pid=,time=,comm=` into cumulative CPU time per process. */
export function parseProcessCpuTimes(output: string): Map<number, CpuTimeSample> {
  const samples = new Map<number, CpuTimeSample>()
  for (const line of output.split('\n')) {
    const match = /^\s*(\d+)\s+([\d\-.:]+)\s+(.+?)\s*$/.exec(line)
    if (!match)
      continue
    const pid = Number(match[1])
    const seconds = parsePsCpuSeconds(match[2]!)
    if (!Number.isSafeInteger(pid) || seconds == null)
      continue
    samples.set(pid, { seconds, command: match[3]! })
  }
  return samples
}

/**
 * Parse one `/proc/<pid>/stat` line into cumulative CPU seconds.
 *
 * The command sits in parentheses in field two and may itself contain spaces
 * and parentheses, so the fields after it are found from the LAST `)` rather
 * than by splitting the whole line.
 */
export function parseProcStatCpuTime(stat: string, clockTicksPerSecond: number): CpuTimeSample | null {
  if (!Number.isSafeInteger(clockTicksPerSecond) || clockTicksPerSecond <= 0)
    return null
  const commandEnd = stat.lastIndexOf(')')
  const commandStart = stat.indexOf('(')
  if (commandStart === -1 || commandEnd < commandStart)
    return null
  const command = stat.slice(commandStart + 1, commandEnd)
  // Fields from `state` onward, so utime and stime are index 11 and 12.
  const fields = stat.slice(commandEnd + 2).split(' ')
  const utime = Number(fields[11])
  const stime = Number(fields[12])
  if (!Number.isFinite(utime) || !Number.isFinite(stime))
    return null
  return { seconds: (utime + stime) / clockTicksPerSecond, command }
}

/** Parse the value printed by `getconf CLK_TCK`. */
export function parseLinuxClockTicks(output: string): number | null {
  const ticks = Number(output.trim())
  return Number.isSafeInteger(ticks) && ticks > 0 ? ticks : null
}

/** Resolve Linux's runtime clock rate once for every proc sample in this process. */
export async function readLinuxClockTicksPerSecond(): Promise<number | null> {
  linuxClockTicksPromise ??= (async () => {
    try {
      const child = Bun.spawn(['getconf', 'CLK_TCK'], { stdout: 'pipe', stderr: 'ignore' })
      const [output, exitCode] = await Promise.all([
        new Response(child.stdout).text(),
        child.exited,
      ])
      return exitCode === 0 ? parseLinuxClockTicks(output) : null
    }
    catch {
      return null
    }
  })()
  return linuxClockTicksPromise
}

/** Read one Linux process at the host kernel's CPU tick precision. */
export async function readProcProcessCpuTime(
  pid: number,
  procRoot = '/proc',
  clockTicksPerSecond?: number | null,
): Promise<CpuTimeSample | null> {
  try {
    const ticks = clockTicksPerSecond === undefined
      ? await readLinuxClockTicksPerSecond()
      : clockTicksPerSecond
    if (ticks == null)
      return null
    return parseProcStatCpuTime(await readFile(`${procRoot}/${pid}/stat`, 'utf8'), ticks)
  }
  catch {
    return null
  }
}

/** Apply the busy threshold to instantaneous readings. */
function selectBusyProcesses(processes: BusyProcess[]): BusyProcess[] {
  processes.sort((a, b) => b.cpuPercent - a.cpuPercent)
  const individuallyBusy = processes.filter(candidate => candidate.cpuPercent >= BUSY_PROCESS_CPU_PERCENT)
  if (individuallyBusy.length > 0)
    return individuallyBusy

  const contributors: BusyProcess[] = []
  let combinedCpu = 0
  for (const candidate of processes) {
    contributors.push(candidate)
    combinedCpu += candidate.cpuPercent
    if (combinedCpu >= BUSY_PROCESS_CPU_PERCENT)
      return contributors
  }
  return []
}

/**
 * Turn two cumulative CPU readings into what each process is using right now.
 *
 * This is the same correction the CPU column already applies to the server
 * under test. `ps -o %cpu` is CPU time over the process's whole lifetime, so a
 * neighbour that has been idle for hours and starts saturating a core keeps
 * reporting a tiny percentage - which is precisely the case a benchmark host
 * has to refuse, and the one the lifetime average cannot see. It also reports
 * a long-finished burst forever, which aborts runs on a host that is now idle.
 */
export function busyProcessesFromSamples(
  before: Map<number, CpuTimeSample>,
  after: Map<number, CpuTimeSample>,
  elapsedSeconds: number,
  ownPid = process.pid,
): BusyProcess[] {
  if (!(elapsedSeconds > 0))
    return []
  const processes: BusyProcess[] = []
  for (const [pid, sample] of after) {
    if (pid === ownPid)
      continue
    const previous = before.get(pid)
    // A process that appeared inside the window has no interval to compare
    // against; it is measured by the next check rather than guessed at here.
    if (!previous)
      continue
    const used = sample.seconds - previous.seconds
    if (!Number.isFinite(used) || used <= 0)
      continue
    processes.push({ pid, cpuPercent: (used / elapsedSeconds) * 100, command: sample.command })
  }
  return selectBusyProcesses(processes)
}

async function readProcCpuTimes(procRoot = '/proc'): Promise<Map<number, CpuTimeSample> | null> {
  try {
    const clockTicksPerSecond = await readLinuxClockTicksPerSecond()
    if (clockTicksPerSecond == null)
      return null
    const entries = await readdir(procRoot)
    const samples = new Map<number, CpuTimeSample>()
    await Promise.all(entries.map(async (entry) => {
      const pid = Number(entry)
      if (!Number.isSafeInteger(pid) || pid <= 0)
        return
      const sample = await readProcProcessCpuTime(pid, procRoot, clockTicksPerSecond)
      if (sample)
        samples.set(pid, sample)
    }))
    return samples.size > 0 ? samples : null
  }
  catch {
    return null
  }
}

async function readPsCpuTimes(): Promise<Map<number, CpuTimeSample> | null> {
  try {
    const child = Bun.spawn(['ps', '-A', '-o', 'pid=,time=,comm='], { stdout: 'pipe', stderr: 'ignore' })
    const [output, exitCode] = await Promise.all([
      new Response(child.stdout).text(),
      child.exited,
    ])
    return exitCode === 0 ? parseProcessCpuTimes(output) : null
  }
  catch {
    return null
  }
}

function sampleCpuTimes(): Promise<Map<number, CpuTimeSample> | null> {
  // After resolving CLK_TCK once, `/proc` needs no per-sample subprocess and
  // its host clock ticks beat the whole seconds Linux `ps` prints here.
  return platform() === 'linux'
    ? readProcCpuTimes().then(samples => samples ?? readPsCpuTimes())
    : readPsCpuTimes()
}

/** Best-effort preflight. Unsupported hosts return no readings. */
export async function detectBusyProcesses(): Promise<BusyProcess[]> {
  const before = await sampleCpuTimes()
  if (!before)
    return []
  const start = performance.now()
  await Bun.sleep(HOST_LOAD_SAMPLE_MS)
  const after = await sampleCpuTimes()
  if (!after)
    return []
  return busyProcessesFromSamples(before, after, (performance.now() - start) / 1000)
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
