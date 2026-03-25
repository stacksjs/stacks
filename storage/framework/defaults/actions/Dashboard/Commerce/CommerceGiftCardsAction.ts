import { Action } from '@stacksjs/actions'
import { GiftCard } from '@stacksjs/orm'

export default new Action({
  name: 'CommerceGiftCards',
  description: 'Returns gift cards list with stats and denominations.',
  method: 'GET',
  async handle() {
    const items = await GiftCard.orderBy('created_at', 'desc').limit(50).get()
    const count = await GiftCard.count()

    const stats = [
      { label: 'Outstanding Balance', value: '-' },
      { label: 'Active Cards', value: String(count) },
      { label: 'Redeemed Today', value: '-' },
      { label: 'Sold This Month', value: '-' },
    ]

    const denominations = ['$25', '$50', '$75', '$100', '$150', '$200', 'Custom']

    return {
      giftCards: items.map(i => i.toJSON()),
      stats,
      denominations,
    }
  },
})
