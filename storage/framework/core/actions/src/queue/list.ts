import process from 'node:process'
import { log } from '@stacksjs/logging'
import { Job } from '@stacksjs/orm'

/**
 * `buddy queue:list` — flat-row listing of pending jobs across all
 * queues (or filtered to one with `--queue=<name>`). Companion to
 * `queue:status` (overview counts) and `queue:inspect --id=X`
 * (single-row payload dump). Closes the gap that
 * stacksjs/stacks#1872 Q-11 called out: the audit had `status`
 * (counts) and `inspect` (single row) but nothing for "which jobs
 * are sitting in the queue right now."
 *
 * Filters:
 *   --queue=<name>      only show jobs on this queue
 *   --status=<s>        pending | reserved | delayed  (any: omit)
 *   --limit=<n>         cap rows (default 50)
 */

const options = parseArgs()
const queueName = options.queue
const statusFilter = options.status as 'pending' | 'reserved' | 'delayed' | undefined
const limit = options.limit ? Number.parseInt(options.limit, 10) : 50

try {
  log.info('Fetching queued jobs...\n')

  let jobs = queueName
    ? await Job.where('queue', queueName).get()
    : await Job.all()

  const nowSec = Math.floor(Date.now() / 1000)
  if (statusFilter === 'pending') {
    jobs = jobs.filter((j: any) => !j.reserved_at && (j.available_at ?? 0) <= nowSec)
  }
  else if (statusFilter === 'reserved') {
    jobs = jobs.filter((j: any) => Boolean(j.reserved_at))
  }
  else if (statusFilter === 'delayed') {
    jobs = jobs.filter((j: any) => !j.reserved_at && (j.available_at ?? 0) > nowSec)
  }

  if (Number.isFinite(limit) && limit > 0) {
    jobs = jobs.slice(0, limit)
  }

  if (jobs.length === 0) {
    console.log('✓ No queued jobs found')
    process.exit(0)
  }

  console.log('┌─────┬────────────────────┬──────────────────────────────────┬──────────┬──────────┬─────────────────────┐')
  console.log('│ ID  │ Queue              │ Job                              │ Attempts │ Status   │ Available At        │')
  console.log('├─────┼────────────────────┼──────────────────────────────────┼──────────┼──────────┼─────────────────────┤')

  for (const j of jobs) {
    const jobAny = j as any
    const id = String(jobAny.id ?? '').padEnd(3)
    const queue = String(jobAny.queue ?? 'default').substring(0, 18).padEnd(18)
    const jobName = extractJobName(jobAny.payload).substring(0, 32).padEnd(32)
    const attempts = String(jobAny.attempts ?? 0).padEnd(8)
    const status = (jobAny.reserved_at
      ? 'reserved'
      : (jobAny.available_at ?? 0) > nowSec
          ? 'delayed'
          : 'pending').padEnd(8)
    const avail = formatUnixTime(jobAny.available_at).padEnd(19)
    console.log(`│ ${id} │ ${queue} │ ${jobName} │ ${attempts} │ ${status} │ ${avail} │`)
  }

  console.log('└─────┴────────────────────┴──────────────────────────────────┴──────────┴──────────┴─────────────────────┘')
  console.log(`\nShowing ${jobs.length} job(s)${queueName ? ` on queue '${queueName}'` : ''}${statusFilter ? ` (status=${statusFilter})` : ''}`)

  process.exit(0)
}
catch (error) {
  // Same fresh-project guard as queue:failed.
  const message = error instanceof Error ? error.message : String(error)
  if (/no such table:\s*jobs\b/i.test(message)) {
    process.stdout.write('Queue tables are not set up yet.\n')
    process.stdout.write('Run `buddy queue:table` to create the migrations, then `buddy migrate` to apply them.\n')
    process.exit(0)
  }
  log.error('Failed to list queued jobs', error)
  process.exit(1)
}

function extractJobName(payload: unknown): string {
  if (typeof payload !== 'string') return 'unknown'
  try {
    const parsed = JSON.parse(payload) as { jobName?: string, name?: string }
    return parsed.jobName ?? parsed.name ?? 'unknown'
  }
  catch {
    return 'unknown'
  }
}

function formatUnixTime(seconds: unknown): string {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds)) return 'N/A'
  return new Date(seconds * 1000).toISOString().slice(0, 19).replace('T', ' ')
}

function parseArgs(): { [key: string]: string } {
  const args: { [key: string]: string } = {}
  process.argv.forEach((arg) => {
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=')
      if (key && value) args[key] = value
    }
  })
  return args
}
