import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { db } from '@stacksjs/database'
import { Campaign } from '@stacksjs/orm'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'CampaignDestroyAction',
  description: 'Deletes an unused Campaign record from the dashboard.',
  method: 'DELETE',

  async handle(request: RequestInstance) {
    const id = Number(request.getParam('id'))
    const campaign = await Campaign.find(id)
    if (!campaign)
      return response.json({ message: 'Campaign not found.' }, 404)

    const status = String(campaign.get('status') || '')
    const sendRow = await db
      .selectFrom('campaign_sends')
      .select(db.fn.count('id').as('count'))
      .where('campaign_id', '=', id)
      .executeTakeFirst()
    if (Number(sendRow?.count || 0) > 0 || ['scheduled', 'sending', 'sent'].includes(status)) {
      return response.json({
        message: 'Scheduled campaigns and campaigns with delivery history cannot be deleted.',
      }, 409)
    }

    await campaign.delete()
    return response.noContent()
  },
})
