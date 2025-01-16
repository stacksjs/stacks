import { globSync, fs } from '@stacksjs/storage'
import { path } from '@stacksjs/path'
import type { JobOptions } from '@stacksjs/types'
import { Every } from '@stacksjs/types'
import { snakeCase } from '@stacksjs/strings'


interface JobSchedule {
  jobName: string
  times: string[]
  rate: string,
  path: string,
}

const scheduleFile = path.appPath('jobSchedule.json')

export async function runScheduler(threshold = 3, regenerationCount = 10): Promise<void> {
  const now = new Date().toISOString()
  let schedules = loadSchedule()

  // Fetch job files and prefill missing schedules
  const jobFiles = globSync([path.appPath('Jobs/*.ts')], { absolute: true })
  for (const jobFile of jobFiles) {
    try {
      const jobModule = await import(jobFile)
      const job = jobModule.default as JobOptions

      const jobName = snakeCase(job.name || 'UnkownJob')

      if (job.rate) {
        if (!schedules.some(schedule => schedule.jobName === jobName)) {
          console.log(`Prefilling schedule for job: ${jobName}`)
          const initialSchedule = generateSchedule(jobName || '', getJobInterval(job.rate), regenerationCount)

          schedules.push({
            jobName: jobName || '',
            rate: job.rate,
            times: initialSchedule.times,
            path: jobFile
          })
        }
      } else {
        console.log(`Skipping job: ${jobName} as it has no schedule rate`)
      }
    } catch (error) {
      console.error(`Failed to process job file: ${jobFile}`, error)
    }
  }

  for (const schedule of schedules) {
    const dueTimes = schedule.times.filter(time => time <= now)

    // Run due jobs
    for (const time of dueTimes) {
      console.log(`Running job: ${schedule.jobName} at scheduled time: ${time}`)
      await runJob(schedule.path)
    }

    // Remove executed times
    schedule.times = schedule.times.filter(time => time > now)

    // Regenerate schedule if below threshold
    if (schedule.times.length < threshold) {
      console.log(`Regenerating schedule for job: ${schedule.jobName}`)
      const lastTime = new Date(schedule.times[schedule.times.length - 1] || now)
      const intervalMinutes = getJobInterval(schedule.rate)
      const newSchedule = generateSchedule(schedule.jobName, intervalMinutes, regenerationCount, lastTime)

      schedule.times.push(...newSchedule.times)
    }
  }

  // Save updated schedule
  saveSchedule(schedules.filter(schedule => schedule.times.length > 0))
}

export function getJobInterval(rate: string): number {
  switch (rate) {
    case Every.Minute:
      return 1
    case Every.TwoMinutes:
      return 2
    case Every.FiveMinutes:
      return 5
    case Every.TenMinutes:
      return 10
    case Every.FifteenMinutes:
      return 15
    case Every.ThirtyMinutes:
      return 30
    default:
      throw new Error(`Unsupported rate: ${rate}`)
  }
}

// Mock function to simulate job execution
async function runJob(path: string): Promise<void> {
  const jobFile = await import(path)
  const job = jobFile.default as JobOptions
  
  if (job)
    await job?.handle()
}

// Save the schedule to a file
function saveSchedule(schedule: JobSchedule[]): void {
  fs.writeFileSync(scheduleFile, JSON.stringify(schedule, null, 2))
}
  
function loadSchedule(): JobSchedule[] {
  if (!fs.existsSync(scheduleFile)) return []
  return JSON.parse(fs.readFileSync(scheduleFile, 'utf-8'))
}

export function generateSchedule(jobName: string, intervalMinutes: number, count: number, startTime = new Date()): { jobName: string; times: string[] } {
  const times: string[] = []
  let nextTime = new Date(startTime)

  for (let i = 0; i < count; i++) {
    nextTime.setMinutes(nextTime.getMinutes() + intervalMinutes)
    times.push(nextTime.toISOString())
  }

  return { jobName, times }
}
