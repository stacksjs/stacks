import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { db } from '@stacksjs/database'
import { EmailList } from '@stacksjs/orm'
import { response } from '@stacksjs/router'
import { marketingModelError, marketingRecordId } from './marketing-response'

export default new Action({
  name: 'MarketingListDestroyAction',
  description: 'Deletes an unused EmailList record from the dashboard.',
  method: 'DELETE',

  async handle(request: RequestInstance) {
    const id = marketingRecordId(request)
    if (!id)
      return response.json({ message: 'A valid email list id is required.' }, 400)

    try {
      const list = await EmailList.find(id)
      if (!list)
        return response.json({ message: 'Email list not found.' }, 404)

      const [membership, campaign] = await Promise.all([
        db
          .selectFrom('email_list_subscribers')
          .select(db.fn.count('id').as('count'))
          .where('email_list_id', '=', id)
          .executeTakeFirst(),
        db
          .selectFrom('campaigns')
          .select(db.fn.count('id').as('count'))
          .where('email_list_id', '=', id)
          .executeTakeFirst(),
      ])
      const membershipCount = Number(membership?.count || 0)
      const campaignCount = Number(campaign?.count || 0)
      if (membershipCount > 0 || campaignCount > 0) {
        return response.json({
          message: 'Archive this list instead. Lists with memberships or campaigns cannot be deleted.',
        }, 409)
      }

      await list.delete()
      return response.noContent()
    }
    catch (error) {
      return marketingModelError(error, 'Email list could not be deleted.', 'ListDestroyAction')
    }
  },
})
