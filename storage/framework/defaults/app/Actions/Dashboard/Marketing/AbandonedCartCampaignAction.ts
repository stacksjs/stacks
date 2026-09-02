import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { config } from '@stacksjs/config'
import { Campaign } from '@stacksjs/orm'
import { response } from '@stacksjs/router'
import { recoveryCampaignWriteData, validateRecoveryCampaign } from './abandoned-cart-records'
import { marketingModelError } from './marketing-response'

/**
 * Write the campaign that goes after the cold carts.
 *
 * It is an ordinary Campaign row - the send pipeline, the delivery reporting
 * and the campaigns screen all work on it unchanged. What makes it a recovery
 * campaign is the segment stored on it, which names the trigger and the rules
 * it was written with, so the campaign still says who it was for long after
 * those carts have converted or been swept.
 *
 * Created as a draft, or scheduled if a time was given. Nothing sends from
 * here: delivery goes through `CampaignSendAction` like every other campaign,
 * so there is one place where mail actually leaves.
 */
export default new Action({
  name: 'AbandonedCartCampaignAction',
  description: 'Creates a cart-recovery campaign aimed at customers who left a cart behind.',
  method: 'POST',
  model: Campaign,

  async handle(request: RequestInstance) {
    const data = recoveryCampaignWriteData(
      await request.all(),
      String(config.commerce?.currency || 'USD').toUpperCase(),
    )

    const validationError = validateRecoveryCampaign(data)
    if (validationError)
      return response.json({ message: validationError }, 422)

    try {
      const campaign = await Campaign.create({
        ...data,
        audience_size: 0,
        sent_count: 0,
      })

      return response.json({ id: campaign.get('id') }, 201)
    }
    catch (error) {
      return marketingModelError(error, 'Recovery campaign could not be created.', 'AbandonedCartCampaignAction')
    }
  },
})
