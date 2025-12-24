import process from 'node:process'
import { log } from '@stacksjs/logging'
import { Job } from '@stacksjs/orm'
import { FailedJob } from '../../../orm/src/models/FailedJob'

const options = parseArgs()
const jobId = options.id
const failedFlag = options.failed === 'true'

interface QueuePayload {
  path: string
  name: string
  maxTries: number
  timeOut: number | null
  timeOutAt: Date | null
  params: any
  classPayload: string
}

try {
  if (!jobId) {
    log.error('Please provide a job ID')
    log.info('Usage: buddy queue:inspect --id=<jobId> [--failed]')
    process.exit(1)
  }

  const id = Number.parseInt(jobId, 10)

  if (Number.isNaN(id)) {
    log.error('Invalid job ID provided')
    process.exit(1)
  }

  if (failedFlag) {
    // Inspect failed job
    const job = await FailedJob.find(id)

    if (!job) {
      log.error(`Failed job with ID ${id} not found`)
      process.exit(1)
    }

    console.log('\n┌────────────────────────────────────────────────────────────────┐')
    console.log('│                    Failed Job Details                          │')
    console.log('├────────────────────────────────────────────────────────────────┤')
    console.log(`│ ID:         ${String(job.id).padEnd(52)} │`)
    console.log(`│ Queue:      ${(job.queue || 'default').padEnd(52)} │`)
    console.log(`│ Connection: ${(job.connection || 'database').padEnd(52)} │`)
    console.log(`│ Failed At:  ${(job.failed_at || 'N/A').padEnd(52)} │`)
    console.log('├────────────────────────────────────────────────────────────────┤')
    console.log('│ Exception:                                                     │')
    console.log('├────────────────────────────────────────────────────────────────┤')

    // Display exception with word wrap
    const exception = job.exception || 'Unknown error'
    const lines = exception.match(/.{1,62}/g) || [exception]
    for (const line of lines.slice(0, 20)) {
      console.log(`│ ${line.padEnd(62)} │`)
    }
    if (lines.length > 20) {
      console.log(`│ ... (${lines.length - 20} more lines)`.padEnd(64) + ' │')
    }

    console.log('├────────────────────────────────────────────────────────────────┤')
    console.log('│ Payload:                                                       │')
    console.log('├────────────────────────────────────────────────────────────────┤')

    if (job.payload) {
      try {
        const payload: QueuePayload = JSON.parse(job.payload)
        console.log(`│ Name:       ${payload.name.padEnd(52)} │`)
        console.log(`│ Path:       ${payload.path.padEnd(52)} │`)
        console.log(`│ Max Tries:  ${String(payload.maxTries).padEnd(52)} │`)
        console.log('│ Parameters:                                                    │')

        const paramsJson = JSON.stringify(payload.params, null, 2)
        const paramLines = paramsJson.split('\n')
        for (const line of paramLines.slice(0, 15)) {
          console.log(`│   ${line.substring(0, 60).padEnd(60)} │`)
        }
        if (paramLines.length > 15) {
          console.log(`│   ... (${paramLines.length - 15} more lines)`.padEnd(64) + ' │')
        }
      }
      catch {
        console.log(`│ Raw: ${job.payload.substring(0, 58).padEnd(58)} │`)
      }
    }
    else {
      console.log('│ (No payload)                                                   │')
    }

    console.log('└────────────────────────────────────────────────────────────────┘')

    console.log('\nActions:')
    console.log(`  Retry this job: buddy queue:retry --id=${id}`)
    console.log(`  Delete this job: buddy queue:flush --id=${id}`)
  }
  else {
    // Inspect pending/processing job
    const job = await Job.find(id)

    if (!job) {
      log.error(`Job with ID ${id} not found`)
      log.info('Tip: Use --failed flag to inspect failed jobs')
      process.exit(1)
    }

    const now = Math.floor(Date.now() / 1000)
    let status = 'Pending'
    if (job.reserved_at) {
      status = 'Processing'
    }
    else if (job.available_at && job.available_at > now) {
      status = 'Delayed'
    }

    console.log('\n┌────────────────────────────────────────────────────────────────┐')
    console.log('│                       Job Details                              │')
    console.log('├────────────────────────────────────────────────────────────────┤')
    console.log(`│ ID:           ${String(job.id).padEnd(50)} │`)
    console.log(`│ Queue:        ${(job.queue || 'default').padEnd(50)} │`)
    console.log(`│ Status:       ${status.padEnd(50)} │`)
    console.log(`│ Attempts:     ${String(job.attempts || 0).padEnd(50)} │`)
    console.log('├────────────────────────────────────────────────────────────────┤')

    // Timing information
    if (job.available_at) {
      const availableDate = new Date(job.available_at * 1000)
      console.log(`│ Available At: ${availableDate.toISOString().padEnd(50)} │`)
    }

    if (job.reserved_at) {
      const reservedDate = new Date(job.reserved_at * 1000)
      console.log(`│ Reserved At:  ${reservedDate.toISOString().padEnd(50)} │`)
    }

    if (job.created_at) {
      console.log(`│ Created At:   ${String(job.created_at).padEnd(50)} │`)
    }

    console.log('├────────────────────────────────────────────────────────────────┤')
    console.log('│ Payload:                                                       │')
    console.log('├────────────────────────────────────────────────────────────────┤')

    if (job.payload) {
      try {
        const payload: QueuePayload = JSON.parse(job.payload)
        console.log(`│ Name:       ${payload.name.padEnd(52)} │`)
        console.log(`│ Path:       ${payload.path.padEnd(52)} │`)
        console.log(`│ Max Tries:  ${String(payload.maxTries).padEnd(52)} │`)
        console.log(`│ Timeout:    ${String(payload.timeOut || 'N/A').padEnd(52)} │`)
        console.log('│ Parameters:                                                    │')

        const paramsJson = JSON.stringify(payload.params, null, 2)
        const paramLines = paramsJson.split('\n')
        for (const line of paramLines.slice(0, 15)) {
          console.log(`│   ${line.substring(0, 60).padEnd(60)} │`)
        }
        if (paramLines.length > 15) {
          console.log(`│   ... (${paramLines.length - 15} more lines)`.padEnd(64) + ' │')
        }

        // Show job configuration if available
        if (payload.classPayload) {
          try {
            const classConfig = JSON.parse(payload.classPayload)
            console.log('├────────────────────────────────────────────────────────────────┤')
            console.log('│ Job Configuration:                                             │')
            console.log('├────────────────────────────────────────────────────────────────┤')
            console.log(`│ Tries:      ${String(classConfig.tries || 3).padEnd(52)} │`)
            console.log(`│ Timeout:    ${String(classConfig.timeout || 60).padEnd(52)} │`)
            if (classConfig.backoff) {
              console.log(`│ Backoff:    ${String(JSON.stringify(classConfig.backoff)).substring(0, 52).padEnd(52)} │`)
            }
          }
          catch {
            // Ignore parse errors for class payload
          }
        }
      }
      catch {
        console.log(`│ Raw: ${job.payload.substring(0, 58).padEnd(58)} │`)
      }
    }
    else {
      console.log('│ (No payload)                                                   │')
    }

    console.log('└────────────────────────────────────────────────────────────────┘')

    if (status === 'Delayed' && job.available_at) {
      const waitTime = job.available_at - now
      console.log(`\nThis job will be available in ${waitTime} second(s)`)
    }
  }

  process.exit(0)
}
catch (error) {
  log.error('Failed to inspect job', error)
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
      else if (key) {
        args[key] = 'true'
      }
    }
  })

  return args
}
