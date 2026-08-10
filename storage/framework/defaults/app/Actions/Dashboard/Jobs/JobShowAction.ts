import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { FailedJob, Job } from '@stacksjs/orm'
import { response } from '@stacksjs/router'
import { dashboardOperationalError } from '../dashboard-response'
import { normalizeActiveJob, normalizeFailedJob, parseJobReference } from './job-records'

export default new Action({
  name: 'JobShowAction',
  description: 'Returns one native Job or FailedJob record for dashboard inspection.',
  method: 'GET',
  async handle(request: RequestInstance) {
    const reference = request.getParam('id')
    const parsed = parseJobReference(reference)
    const id = Number(parsed.id)

    if (!Number.isFinite(id) || id <= 0)
      return response.json({ message: 'Invalid job id.' }, 400)

    try {
      if (parsed.source === 'failed') {
        const record = await FailedJob.find(id)
        return record
          ? { job: normalizeFailedJob(record) }
          : response.json({ message: 'Job not found.' }, 404)
      }

      if (parsed.source === 'job') {
        const record = await Job.find(id)
        return record
          ? { job: normalizeActiveJob(record) }
          : response.json({ message: 'Job not found.' }, 404)
      }

      const activeRecord = await Job.find(id)
      if (activeRecord)
        return { job: normalizeActiveJob(activeRecord) }

      const failedRecord = await FailedJob.find(id)
      return failedRecord
        ? { job: normalizeFailedJob(failedRecord) }
        : response.json({ message: 'Job not found.' }, 404)
    }
    catch (error) {
      return dashboardOperationalError(error, 'Job could not be loaded.', 'JobShowAction')
    }
  },
})
