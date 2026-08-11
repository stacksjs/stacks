import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { campaigns, CampaignStateConflictError } from '@stacksjs/newsletter'
import { response } from '@stacksjs/router'
import { dashboardOperationalError } from '../dashboard-response'
import { loadCampaignDeliveryContext, validateCampaignDelivery } from './campaign-delivery'
import { marketingRecordId } from './marketing-response'

export default new Action({
  name: 'CampaignSendAction',
  description: 'Queues a ready email campaign for immediate delivery.',
  method: 'POST',

  async handle(request: RequestInstance) {
    const id = marketingRecordId(request)
    if (!id)
      return response.json({ message: 'A valid campaign id is required.' }, 400)

    let context
    try {
      context = await loadCampaignDeliveryContext(id)
    }
    catch (error) {
      return dashboardOperationalError(error, 'Campaign delivery prerequisites could not be loaded.', 'CampaignSendAction.prerequisites')
    }
    if (!context.campaign)
      return response.json({ message: 'Campaign not found.' }, 404)

    const validationError = validateCampaignDelivery(
      context.campaign,
      'send',
      context.activeMembers,
      context.listStatus,
    )
    if (validationError)
      return response.json({ message: validationError }, 422)

    try {
      await campaigns.sendNow(id)
      return response.json({ id, status: 'sending' }, 202)
    }
    catch (error) {
      if (error instanceof CampaignStateConflictError)
        return response.json({ message: 'Campaign delivery state changed. Refresh and try again.' }, 409)
      return dashboardOperationalError(error, 'Campaign could not be queued.', 'CampaignSendAction.queue', 500)
    }
  },
})
