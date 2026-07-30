import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { db } from '@stacksjs/database'
import { campaigns } from '@stacksjs/newsletter'
import { Campaign, EmailList } from '@stacksjs/orm'
import { response } from '@stacksjs/router'
import {
  campaignScheduleIso,
  validateCampaignDelivery,
} from './campaign-delivery'

export default new Action({
  name: 'CampaignScheduleAction',
  description: 'Schedules a ready email campaign for future delivery.',
  method: 'POST',

  async handle(request: RequestInstance) {
    const id = Number(request.getParam('id'))
    const campaign = await Campaign.find(id)
    if (!campaign)
      return response.json({ message: 'Campaign not found.' }, 404)

    const listId = Number(campaign.get('email_list_id') || 0)
    const list = listId ? await EmailList.find(listId) : null
    const memberRow = listId
      ? await db
          .selectFrom('email_list_subscribers')
          .select(db.fn.count('id').as('count'))
          .where('email_list_id', '=', listId)
          .where('status', '=', 'subscribed')
          .executeTakeFirst()
      : null
    const validationError = validateCampaignDelivery(
      campaign,
      'schedule',
      Number(memberRow?.count || 0),
      String(list?.get('status') || ''),
    )
    if (validationError)
      return response.json({ message: validationError }, 422)

    const schedule = campaignScheduleIso((await request.all()).scheduledAt)
    if (schedule.error)
      return response.json({ message: schedule.error }, 422)

    await campaigns.schedule(id, schedule.value)
    return response.json({ id, status: 'scheduled', scheduledAt: schedule.value }, 202)
  },
})
