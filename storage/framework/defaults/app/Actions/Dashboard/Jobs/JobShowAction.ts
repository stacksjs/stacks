import { Action } from '@stacksjs/actions'
import { FailedJob, Job } from '@stacksjs/orm'
import { request } from '@stacksjs/router'
import { normalizeActiveJob, normalizeFailedJob, parseJobReference } from './job-records'

export default new Action({
  name: 'JobShowAction',
  description: 'Returns one native Job or FailedJob record for dashboard inspection.',
  method: 'GET',
  async handle() {
    const reference = String((request as any).params?.id || '')
    const parsed = parseJobReference(reference)
    const id = Number(parsed.id)

    if (!Number.isFinite(id) || id <= 0)
      return { job: null, error: 'Invalid job id.' }

    try {
      if (parsed.source === 'failed') {
        const record = await FailedJob.find(id)
        return { job: record ? normalizeFailedJob(record) : null }
      }

      if (parsed.source === 'job') {
        const record = await Job.find(id)
        return { job: record ? normalizeActiveJob(record) : null }
      }

      const activeRecord = await Job.find(id)
      if (activeRecord)
        return { job: normalizeActiveJob(activeRecord) }

      const failedRecord = await FailedJob.find(id)
      return { job: failedRecord ? normalizeFailedJob(failedRecord) : null }
    }
    catch (error) {
      return {
        job: null,
        error: error instanceof Error ? error.message : 'Job could not be loaded.',
      }
    }
  },
})
