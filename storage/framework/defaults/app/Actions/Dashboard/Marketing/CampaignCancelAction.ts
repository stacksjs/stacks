import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { campaigns, CampaignStateConflictError } from '@stacksjs/newsletter'
import { Campaign } from '@stacksjs/orm'
import { response } from '@stacksjs/router'
import { dashboardOperationalError } from '../dashboard-response'
import { validateCampaignDelivery } from './campaign-delivery'
import { marketingRecordId } from './marketing-response'

export default new Action({
  name: 'CampaignCancelAction',
  description: 'Cancels scheduled or active email campaign delivery.',
  method: 'POST',

  async handle(request: RequestInstance) {
    const id = marketingRecordId(request)
    if (!id)
      return response.json({ message: 'A valid campaign id is required.' }, 400)

    let campaign
    try {
      campaign = await Campaign.find(id)
    }
    catch (error) {
      return dashboardOperationalError(error, 'Campaign could not be loaded.', 'CampaignCancelAction.read')
    }
    if (!campaign)
      return response.json({ message: 'Campaign not found.' }, 404)

    const validationError = validateCampaignDelivery(campaign, 'cancel')
    if (validationError)
      return response.json({ message: validationError }, 422)

    try {
      await campaigns.cancel(id)
      return response.json({ id, status: 'cancelled' })
    }
    catch (error) {
      if (error instanceof CampaignStateConflictError)
        return response.json({ message: 'Campaign delivery state changed. Refresh and try again.' }, 409)
      return dashboardOperationalError(error, 'Campaign could not be cancelled.', 'CampaignCancelAction.cancel', 500)
    }
  },
})
