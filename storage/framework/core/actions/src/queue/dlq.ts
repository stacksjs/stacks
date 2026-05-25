import process from 'node:process'
import { log } from '@stacksjs/logging'
import { listDeadLetterJobs } from '@stacksjs/queue'

/**
 * `buddy queue:dlq` — list dead-letter rows
 * (stacksjs/stacks#1885). Same shape as `queue:failed` but pulls
 * from `dead_letter_jobs` and shows the `reason` column so the
 * operator can triage repeat-failure vs poison vs circuit-broken.
 */

const options = parseArgs()
const queueName = options.queue || undefined
const reason = (options.reason || undefined) as ('repeat-failure' | 'poison-detected' | 'circuit-broken' | 'manual') | undefined
const sinceArg = options.since
const limit = options.limit ? Number.parseInt(options.limit, 10) : 100

try {
  log.info('Fetching dead-letter jobs...\n')

  const sinceCutoffMs = sinceArg ? parseSinceDuration(sinceArg) ?? undefined : undefined
  const rows = await listDeadLetterJobs({ queue: queueName, reason, sinceCutoffMs, limit })

  if (rows.length === 0) {
    console.log('✓ No dead-letter jobs found')
    process.exit(0)
  }

  console.log('┌─────┬──────────────────────────────────┬──────────────────┬──────────┬──────────────────────────┐')
  console.log('│ ID  │ Queue                            │ Reason           │ Failures │ Dead-Lettered At         │')
  console.log('├─────┼──────────────────────────────────┼──────────────────┼──────────┼──────────────────────────┤')
  for (const row of rows) {
    const id = String(row.id).padEnd(3)
    const q = (row.queue || 'default').substring(0, 32).padEnd(32)
    const r = (row.reason || 'unknown').substring(0, 16).padEnd(16)
    const f = String(row.total_failures ?? 1).padEnd(8)
    const dt = (row.dead_lettered_at || 'N/A').substring(0, 24).padEnd(24)
    console.log(`│ ${id} │ ${q} │ ${r} │ ${f} │ ${dt} │`)
  }
  console.log('└─────┴──────────────────────────────────┴──────────────────┴──────────┴──────────────────────────┘')
  console.log(`\nShowing ${rows.length} dead-letter job(s)`)
  process.exit(0)
}
catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  if (/no such table:\s*dead_letter_jobs\b/i.test(message)) {
    process.stdout.write('Dead-letter queue table is not set up yet.\n')
    process.stdout.write('Run `buddy queue:table` to create the migrations, then `buddy migrate` to apply them.\n')
    process.exit(0)
  }
  log.error('Failed to fetch dead-letter jobs', error)
  process.exit(1)
}

function parseArgs(): Record<string, string> {
  const args: Record<string, string> = {}
  process.argv.forEach((arg) => {
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=')
      if (key && value) args[key] = value
    }
  })
  return args
}

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
        : 86_400_000
  return Date.now() - n * mult
}
