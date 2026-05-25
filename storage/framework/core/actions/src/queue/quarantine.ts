import process from 'node:process'
import { log } from '@stacksjs/logging'
import { listQuarantined, quarantineJob } from '@stacksjs/queue'

const options = parseArgs()

try {
  if (options.add) {
    // `buddy queue:quarantine --add=JobName` — manually quarantine
    const jobName = options.add
    await quarantineJob(jobName)
    log.success(`Quarantined ${jobName}`)
    process.exit(0)
  }

  // Default: list every quarantined entry
  const rows = await listQuarantined()
  if (rows.length === 0) {
    console.log('✓ No jobs currently quarantined')
    process.exit(0)
  }

  console.log('┌─────┬──────────────────────────────────┬──────────────────┬──────────┬──────────────────────────┐')
  console.log('│ ID  │ Job Name                         │ Payload Hash     │ Failures │ Quarantined At           │')
  console.log('├─────┼──────────────────────────────────┼──────────────────┼──────────┼──────────────────────────┤')
  for (const row of rows) {
    const id = String(row.id).padEnd(3)
    const jn = (row.job_name || '?').substring(0, 32).padEnd(32)
    const ph = (row.payload_hash || '?').substring(0, 16).padEnd(16)
    const fc = String(row.failure_count ?? 0).padEnd(8)
    const qa = (row.quarantined_at || 'N/A').substring(0, 24).padEnd(24)
    console.log(`│ ${id} │ ${jn} │ ${ph} │ ${fc} │ ${qa} │`)
  }
  console.log('└─────┴──────────────────────────────────┴──────────────────┴──────────┴──────────────────────────┘')
  console.log(`\n${rows.length} quarantined entrie(s). Use \`queue:unquarantine <JobName>\` to lift.`)
  process.exit(0)
}
catch (error) {
  log.error('Failed to handle queue:quarantine', error)
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
