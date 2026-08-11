import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { config } from '@stacksjs/config'
import { Campaign } from '@stacksjs/orm'
import { response } from '@stacksjs/router'
import { campaignWriteData, validateCampaignWriteData } from './campaign-records'
import { marketingModelError, marketingRecordId } from './marketing-response'

export default new Action({
  name: 'CampaignUpdateAction',
  description: 'Updates an editable Campaign record from the dashboard.',
  method: 'PATCH',
  model: Campaign,

  async handle(request: RequestInstance) {
    const id = marketingRecordId(request)
    if (!id)
      return response.json({ message: 'A valid campaign id is required.' }, 400)
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
      const campaign = await Campaign.find(id)
      if (!campaign)
        return response.json({ message: 'Campaign not found.' }, 404)

      const currentStatus = String(campaign.get('status') || '')
      if (['sending', 'sent'].includes(currentStatus))
        return response.json({ message: 'Campaigns that entered delivery cannot be edited.' }, 409)

      await campaign.update(data)
      return response.json({ id })
    }
    catch (error) {
      return marketingModelError(error, 'Campaign could not be updated.', 'CampaignUpdateAction')
    }
  },
})
