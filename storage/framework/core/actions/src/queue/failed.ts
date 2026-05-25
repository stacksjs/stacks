import process from 'node:process'
import { log } from '@stacksjs/logging'
import { FailedJob } from '@stacksjs/orm'

const options = parseArgs()
const queueName = options.queue
const sinceArg = options.since
// Date filter (stacksjs/stacks#1872 Q-11). Accepts `--since=1h`,
// `--since=30m`, `--since=2d`. Computed once at startup so the
// filter window is stable across the query.
const sinceCutoff = sinceArg ? parseSinceDuration(sinceArg) : null

try {
  log.info('Fetching failed jobs...\n')

  let failedJobs

  if (queueName) {
    failedJobs = await FailedJob.where('queue', queueName).get()
  }
  else {
    failedJobs = await FailedJob.all()
  }

  // Time-window filter (stacksjs/stacks#1872 Q-11). Applied in JS
  // so the underlying ORM call stays driver-portable — date math
  // in WHERE clauses needs per-driver TZ handling we don't have
  // a unified helper for yet.
  if (sinceCutoff) {
    failedJobs = failedJobs.filter((j: { failed_at?: string | null }) => {
      if (!j.failed_at) return false
      const ts = Date.parse(j.failed_at)
      return Number.isFinite(ts) && ts >= sinceCutoff
    })
  }

  if (failedJobs.length === 0) {
    if (sinceCutoff) {
      console.log(`✓ No failed jobs found since ${sinceArg}`)
    }
    else {
      console.log('✓ No failed jobs found')
    }
    process.exit(0)
  }

  // Display header
  console.log('┌─────┬──────────────────────────────────────────────────┬───────────────────────┬─────────────────────────────────┐')
  console.log('│ ID  │ Queue                                            │ Failed At             │ Exception                       │')
  console.log('├─────┼──────────────────────────────────────────────────┼───────────────────────┼─────────────────────────────────┤')

  for (const job of failedJobs) {
    const id = String(job.id).padEnd(3)
    const queue = (job.queue || 'default').substring(0, 48).padEnd(48)
    const failedAt = (job.failed_at || 'N/A').substring(0, 21).padEnd(21)
    const exception = (job.exception || 'Unknown error').substring(0, 31).padEnd(31)

    console.log(`│ ${id} │ ${queue} │ ${failedAt} │ ${exception} │`)
  }

  console.log('└─────┴──────────────────────────────────────────────────┴───────────────────────┴─────────────────────────────────┘')
  console.log(`\nTotal: ${failedJobs.length} failed job(s)`)

  process.exit(0)
}
catch (error) {
  // Surface a helpful prompt when the queue tables haven't been created yet,
  // matching queue:status behaviour. Without this, fresh projects see an
  // SQLite error stack instead of an actionable next step.
  const message = error instanceof Error ? error.message : String(error)
  if (/no such table:\s*(?:jobs|failed_jobs)\b/i.test(message)) {
    process.stdout.write('Queue tables are not set up yet.\n')
    process.stdout.write('Run `buddy queue:table` to create the migrations, then `buddy migrate` to apply them.\n')
    process.exit(0)
  }
  log.error('Failed to fetch failed jobs', error)
  process.exit(1)
}

function parseArgs(): { [key: string]: string } {
  const args: { [key: string]: string } = {}

  process.argv.forEach((arg) => {
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=')
      if (key && value) {
        args[key] = value
      }
    }
  })

  return args
}

/**
 * Parse a `--since` duration like `30s` / `15m` / `2h` / `7d` into
 * the wall-clock cutoff (ms since epoch). Returns the cutoff so
 * callers compare `failed_at >= cutoff`. Returns `null` on a
 * malformed value (silently — the audit explicitly wanted graceful
 * fallback rather than aborting on a typo). See
 * stacksjs/stacks#1872 Q-11.
 */
function parseSinceDuration(input: string): number | null {
  const m = /^(\d+)([smhd])$/.exec(input.trim())
  if (!m) return null
  const n = Number(m[1])
  if (!Number.isFinite(n) || n <= 0) return null
  const mult = m[2] === 's'
    ? 1_000
    : m[2] === 'm'
      ? 60_000
      : m[2] === 'h'
        ? 3_600_000
        : 86_400_000 // 'd'
  return Date.now() - n * mult
}
