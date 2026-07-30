import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { campaigns } from '@stacksjs/newsletter'
import { Campaign } from '@stacksjs/orm'
import { response } from '@stacksjs/router'
import { validateCampaignDelivery } from './campaign-delivery'

export default new Action({
  name: 'CampaignCancelAction',
  description: 'Cancels scheduled or active email campaign delivery.',
  method: 'POST',

  async handle(request: RequestInstance) {
    const id = Number(request.getParam('id'))
    const campaign = await Campaign.find(id)
    if (!campaign)
      return response.json({ message: 'Campaign not found.' }, 404)

    const validationError = validateCampaignDelivery(campaign, 'cancel')
    if (validationError)
      return response.json({ message: validationError }, 422)

    await campaigns.cancel(id)
    return response.json({ id, status: 'cancelled' })
  },
})
