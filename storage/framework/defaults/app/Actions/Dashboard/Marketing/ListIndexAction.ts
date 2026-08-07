import { Action } from '@stacksjs/actions'
import { db } from '@stacksjs/database'
import { EmailList } from '@stacksjs/orm'
import { normalizeMarketingLists } from './marketing-list-records'

export default new Action({
  name: 'ListIndexAction',
  description: 'Returns persisted email lists with membership and campaign aggregates.',
  method: 'GET',
  apiResponse: true,

  async handle() {
    const weekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 19)
      .replace('T', ' ')

    const [lists, membershipRows, newMembershipRows, campaignRows] = await Promise.all([
      EmailList.orderBy('name', 'asc').get(),
      db
        .selectFrom('email_list_subscribers')
        .select(['email_list_id', 'status', db.fn.count('id').as('count')])
        .groupBy(['email_list_id', 'status'])
        .execute(),
      db
        .selectFrom('email_list_subscribers')
        .select(['email_list_id', db.fn.count('id').as('count')])
        .where('status', '=', 'subscribed')
        .where('subscribed_at', '>=', weekStart)
        .groupBy('email_list_id')
        .execute(),
      db
        .selectFrom('campaigns')
        .select([
          'email_list_id',
          db.fn.count('id').as('count'),
          db.fn.max('sent_at').as('last_sent_at'),
        ])
        .whereNotNull('email_list_id')
        .groupBy('email_list_id')
        .execute(),
    ])

    return normalizeMarketingLists(lists, membershipRows, newMembershipRows, campaignRows)
  },
})
