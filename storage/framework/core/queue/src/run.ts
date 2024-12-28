import { runAction } from '@stacksjs/actions'
import { log } from '@stacksjs/cli'
import { projectPath } from '@stacksjs/path'

interface JobConfig {
  name?: string
  description?: string
  tries?: number
  backoff?: number
  rate?: string
  handle?: () => void | Promise<void>
  action?: string | (() => void | Promise<void>)
}

export async function runJob(name: string): Promise<void> {
  log.info(`Running job: ${name}`)
  try {
    const jobModule = await import(projectPath(`Jobs/${name}.ts`))
    const job = jobModule.default as JobConfig

    if (job.action) {
      // If action is a string, run it via runAction
      if (typeof job.action === 'string') {
        await runAction(job.action)
      }
      // If action is a function, execute it directly
      else if (typeof job.action === 'function') {
        await job.action()
      }
    }
    // If handle is defined, execute it
    else if (job.handle) {
      await job.handle()
    }
    else {
      throw new Error(`Job ${name} must define either a handle function or an action`)
    }
  }
  catch (error) {
    log.error(`Job ${name} failed:`, error)
    throw error
  }
}
