import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { config } from '@stacksjs/config'
import { Campaign } from '@stacksjs/orm'
import { response } from '@stacksjs/router'
import { campaignWriteData, validateCampaignWriteData } from './campaign-records'
import { marketingModelError } from './marketing-response'

export default new Action({
  name: 'CampaignStoreAction',
  description: 'Creates a persisted Campaign record from the dashboard.',
  method: 'POST',
  model: Campaign,

  async handle(request: RequestInstance) {
    const data = campaignWriteData(
      await request.all(),
      String((config as any).commerce?.currency || 'USD').toUpperCase(),
    )
    const validationError = validateCampaignWriteData(data)
    if (validationError)
      return response.json({ message: validationError }, 422)
    if (['sending', 'sent'].includes(data.status))
      return response.json({ message: 'Campaign delivery status is managed by the send pipeline.' }, 422)

    try {
      const campaign = await Campaign.create({
        ...data,
        audience_size: 0,
        sent_count: 0,
        open_rate: null,
        click_rate: null,
        conversion_rate: null,
      })
      return response.json({ id: campaign.get('id') }, 201)
    }
    catch (error) {
      return marketingModelError(error, 'Campaign could not be created.', 'CampaignStoreAction')
    }
  },
})
