import { Action } from '@stacksjs/actions'
import { Customer, GiftCard } from '@stacksjs/orm'
import { dashboardOperationalError } from '../dashboard-response'
import { normalizeGiftCardRecord, summarizeGiftCards } from './gift-card-records'
import { commerceIdentifier, commerceValue } from './commerce-record'

export default new Action({
  name: 'CommerceGiftCardsAction',
  description: 'Returns persisted GiftCard records for dashboard management.',
  method: 'GET',
  apiResponse: true,

  async handle() {
    try {
      const [giftCards, customers] = await Promise.all([
        GiftCard.orderByDesc('id').limit(500).get(),
        Customer.orderBy('id', 'asc').limit(500).get(),
      ])
      const customerIds = new Set(customers.map(customer =>
        commerceIdentifier(commerceValue(customer, 'id', 'uuid'), 'Customer'),
      ))
      const records = giftCards.map(giftCard => normalizeGiftCardRecord(giftCard, customerIds))
      return {
        records,
        summary: summarizeGiftCards(records),
      }
    }
    catch (error) {
      return dashboardOperationalError(error, 'Gift card records could not be read.', 'CommerceGiftCardsAction')
    }
  },
})
