import { Action } from '@stacksjs/actions'
import { GiftCard } from '@stacksjs/orm'
import { normalizeGiftCardRecord, summarizeGiftCards } from './gift-card-records'

export default new Action({
  name: 'CommerceGiftCardsAction',
  description: 'Returns persisted GiftCard records for dashboard management.',
  method: 'GET',
  apiResponse: true,

  async handle() {
    const giftCards = await GiftCard.orderByDesc('id').limit(500).get()
    const records = giftCards.map(normalizeGiftCardRecord)
    return {
      records,
      summary: summarizeGiftCards(records),
    }
  },
})
