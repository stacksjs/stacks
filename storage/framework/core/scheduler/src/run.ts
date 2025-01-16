import { globSync } from '@stacksjs/storage'
import { path } from '@stacksjs/path'
import type { JobOptions } from '@stacksjs/types'
import { Every } from '@stacksjs/types'

export async function runScheduler(): Promise<void> {
  const jobFiles = globSync([path.appPath('Jobs/*.ts')], { absolute: true })

  for (const jobFile of jobFiles) {
    try {
      const jobModule = await import(jobFile)
      const job = jobModule.default as JobOptions

      const interval = job.rate

      if (interval) {
        console.log(`Job found: ${jobFile} with interval: ${interval}`)
        
        const currentTime = new Date()
        const shouldRun = checkInterval(interval, currentTime)

        if (shouldRun) {
          console.log(`Job matches the interval and it's time to run!`)
          await runJob(job)
          console.log(`Job ${jobFile} has been run.`)
        } else {
          console.log(`Job ${jobFile} is not due to run yet.`)
        }
      } else {
        console.log(`Job ${jobFile} does not have a specified interval`)
      }
    } catch (error) {
      console.error(`Failed to process job file: ${jobFile}`, error)
    }
  }
}

function checkInterval(interval: string, currentTime: Date): boolean {
  switch (interval) {
    case Every.Minute:
      return currentTime.getSeconds() === 0
    case Every.FiveMinutes:
      return currentTime.getMinutes() % 5 === 0 && currentTime.getSeconds() === 0
    case Every.Hour:
      return currentTime.getMinutes() === 0 && currentTime.getSeconds() === 0
    default:
      console.log(`Interval ${interval} is not handled yet`)
      return false
  }
}

async function runJob(job: any): Promise<void> {
  console.log(`Running job: ${job.name}`)
}