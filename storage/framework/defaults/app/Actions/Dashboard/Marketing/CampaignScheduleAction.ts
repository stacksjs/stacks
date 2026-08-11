import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { campaigns, CampaignStateConflictError } from '@stacksjs/newsletter'
import { response } from '@stacksjs/router'
import { dashboardOperationalError } from '../dashboard-response'
import {
  campaignScheduleIso,
  loadCampaignDeliveryContext,
  validateCampaignDelivery,
} from './campaign-delivery'
import { marketingRecordId } from './marketing-response'

export default new Action({
  name: 'CampaignScheduleAction',
  description: 'Schedules a ready email campaign for future delivery.',
  method: 'POST',

  async handle(request: RequestInstance) {
    const id = marketingRecordId(request)
    if (!id)
      return response.json({ message: 'A valid campaign id is required.' }, 400)
    const schedule = campaignScheduleIso((await request.all()).scheduledAt)
    if (schedule.error)
      return response.json({ message: schedule.error }, 422)

    let context
    try {
      context = await loadCampaignDeliveryContext(id)
    }
    catch (error) {
      return dashboardOperationalError(error, 'Campaign delivery prerequisites could not be loaded.', 'CampaignScheduleAction.prerequisites')
    }
    if (!context.campaign)
      return response.json({ message: 'Campaign not found.' }, 404)

    const validationError = validateCampaignDelivery(
      context.campaign,
      'schedule',
      context.activeMembers,
      context.listStatus,
    )
    if (validationError)
      return response.json({ message: validationError }, 422)

    try {
      await campaigns.schedule(id, schedule.value)
      return response.json({ id, status: 'scheduled', scheduledAt: schedule.value }, 202)
    }
    catch (error) {
      if (error instanceof CampaignStateConflictError)
        return response.json({ message: 'Campaign delivery state changed. Refresh and try again.' }, 409)
      return dashboardOperationalError(error, 'Campaign could not be scheduled.', 'CampaignScheduleAction.queue', 500)
    }
  },
})
