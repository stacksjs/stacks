import type { JobOptions } from "@stacksjs/types"
import { appPath } from "@stacksjs/path"
import Job from "../../../orm/src/models/Job"

export async function storeJob(name: string, options: JobOptions): Promise<void> {
  const queue = 'default'

  const path = appPath(`Jobs/${name}.ts`, { relative: true })

  const payloadJson = JSON.stringify({
    displayName: path,
    maxTries: options.tries || 1,
    timeout: null,
    timeoutAt: null
  })

  const job = {
    queue,
    payload: payloadJson,
    attempts: 0,
  }

  Job.create(job)
}