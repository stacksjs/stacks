import { join } from 'node:path'
import process from 'node:process'

export interface SchedulerTask {
  name: string
  pattern: string
  timezone: string
  nextRun: string | null
  enabled: boolean
}

interface BuddyResult {
  stdout: string
  stderr: string
  exitCode: number
}

interface SchedulerRegistryPayload {
  jobs?: unknown
}

export class SchedulerOperationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SchedulerOperationError'
  }
}

async function runBuddy(args: string[], timeoutMs = 30_000): Promise<BuddyResult> {
  const subprocess = Bun.spawn([join(process.cwd(), 'buddy'), ...args], {
    cwd: process.cwd(),
    env: { ...process.env, NO_COLOR: '1' },
    stdout: 'pipe',
    stderr: 'pipe',
  })

  let timeout: ReturnType<typeof setTimeout> | undefined
  const timedOut = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => {
      subprocess.kill()
      reject(new SchedulerOperationError(`buddy ${args[0]} timed out.`))
    }, timeoutMs)
  })

  try {
    const [stdout, stderr, exitCode] = await Promise.race([
      Promise.all([
        new Response(subprocess.stdout).text(),
        new Response(subprocess.stderr).text(),
        subprocess.exited,
      ]),
      timedOut,
    ])
    return { stdout, stderr, exitCode }
  }
  finally {
    if (timeout)
      clearTimeout(timeout)
  }
}

export function parseSchedulerRegistry(output: string): SchedulerTask[] {
  const marker = 'STACKS_SCHEDULE_JSON='
  const line = output.split(/\r?\n/).find(entry => entry.startsWith(marker))
  if (!line)
    throw new SchedulerOperationError('The scheduler registry did not return machine-readable output.')

  let payload: SchedulerRegistryPayload
  try {
    payload = JSON.parse(line.slice(marker.length)) as SchedulerRegistryPayload
  }
  catch {
    throw new SchedulerOperationError('The scheduler registry returned invalid JSON.')
  }

  if (!Array.isArray(payload.jobs))
    throw new SchedulerOperationError('The scheduler registry response did not include a task list.')

  return payload.jobs.map((value) => {
    if (!value || typeof value !== 'object')
      throw new SchedulerOperationError('The scheduler registry returned an invalid task.')
    const job = value as Record<string, unknown>
    if (typeof job.name !== 'string' || !job.name.trim())
      throw new SchedulerOperationError('A scheduled task is missing its name.')
    return {
      name: job.name,
      pattern: typeof job.pattern === 'string' ? job.pattern : '',
      timezone: typeof job.timezone === 'string' ? job.timezone : 'UTC',
      nextRun: typeof job.nextRun === 'string' ? job.nextRun : null,
      enabled: job.enabled !== false,
    }
  })
}

export async function listSchedulerTasks(): Promise<SchedulerTask[]> {
  const result = await runBuddy(['schedule:list', '--json'])
  if (result.exitCode !== 0)
    throw new SchedulerOperationError(result.stderr.trim() || 'The scheduler registry could not be loaded.')
  return parseSchedulerRegistry(result.stdout)
}

async function requireSchedulerTask(name: string): Promise<SchedulerTask> {
  const normalized = name.trim()
  const task = (await listSchedulerTasks()).find(entry => entry.name === normalized)
  if (!task)
    throw new SchedulerOperationError(`Scheduled task "${normalized}" was not found.`)
  return task
}

export async function runScheduledTask(name: string): Promise<{ message: string, task: string }> {
  const task = await requireSchedulerTask(name)
  if (!task.enabled)
    throw new SchedulerOperationError(`Scheduled task "${task.name}" is paused.`)
  const result = await runBuddy(['schedule:run-one', task.name], 5 * 60_000)
  if (result.exitCode !== 0)
    throw new SchedulerOperationError(result.stderr.trim() || `Scheduled task "${task.name}" failed.`)
  return { message: `Scheduled task ${task.name} completed.`, task: task.name }
}

export async function setScheduledTaskEnabled(name: string, enabled: boolean): Promise<{ enabled: boolean, message: string, task: string }> {
  const task = await requireSchedulerTask(name)
  if (task.enabled === enabled) {
    return {
      enabled,
      message: `Scheduled task ${task.name} is already ${enabled ? 'active' : 'paused'}.`,
      task: task.name,
    }
  }

  const result = await runBuddy([enabled ? 'schedule:enable' : 'schedule:disable', task.name])
  if (result.exitCode !== 0)
    throw new SchedulerOperationError(result.stderr.trim() || `Scheduled task "${task.name}" could not be updated.`)
  return {
    enabled,
    message: `Scheduled task ${task.name} ${enabled ? 'resumed' : 'paused'}.`,
    task: task.name,
  }
}
