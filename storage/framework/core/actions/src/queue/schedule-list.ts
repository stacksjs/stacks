import process from 'node:process'
import { log } from '@stacksjs/logging'
import { discoverJobs, getScheduledJobs } from '@stacksjs/queue'

try {
  log.info('Discovering scheduled jobs...\n')

  // Discover all jobs first
  await discoverJobs()

  // Get only scheduled jobs
  const scheduledJobs = getScheduledJobs()

  if (scheduledJobs.length === 0) {
    log.info('No scheduled jobs found.')
    log.info('Tip: Add a "rate" or "schedule" property to your job configuration.')
    process.exit(0)
  }

  // Display header
  console.log('┌──────────────────────────────────────────────────┬───────────────────────┬───────────┬─────────┐')
  console.log('│ Job Name                                         │ Schedule              │ Queue     │ Tries   │')
  console.log('├──────────────────────────────────────────────────┼───────────────────────┼───────────┼─────────┤')

  for (const job of scheduledJobs) {
    const name = job.name.substring(0, 48).padEnd(48)
    const schedule = (job.config.rate || job.config.schedule || 'N/A').substring(0, 21).padEnd(21)
    const queue = (job.config.queue || 'default').substring(0, 9).padEnd(9)
    const tries = String(job.config.tries || 3).padStart(7)

    console.log(`│ ${name} │ ${schedule} │ ${queue} │${tries} │`)
  }

  console.log('└──────────────────────────────────────────────────┴───────────────────────┴───────────┴─────────┘')
  console.log(`\nTotal: ${scheduledJobs.length} scheduled job(s)`)

  // Show schedule legend
  console.log('\nSchedule Formats:')
  console.log('  • Cron: "* * * * *" (minute hour day month dayOfWeek)')
  console.log('  • Presets: @hourly, @daily, @weekly, @monthly')
  console.log('  • Every: Every.Minute, Every.Hour, Every.Day')

  process.exit(0)
}
catch (error) {
  log.error('Failed to list scheduled jobs:', error)
  process.exit(1)
}
