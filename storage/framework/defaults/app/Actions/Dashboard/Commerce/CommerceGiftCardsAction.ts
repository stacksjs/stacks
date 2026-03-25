import { Action } from '@stacksjs/actions'
import { GiftCard } from '@stacksjs/orm'

export default new Action({
  name: 'CommerceGiftCards',
  description: 'Returns gift cards list with stats and denominations.',
  method: 'GET',
  async handle() {
    const denominations = ['$25', '$50', '$75', '$100', '$150', '$200', 'Custom']

    try {
      const allCards = await GiftCard.orderByDesc('id').limit(50).get()

      const giftCards = allCards.map(r => ({
        code: String(r.get('code') || ''),
        balance: `$${Number(r.get('balance') || 0)}`,
        initial: `$${Number(r.get('initial_value') || r.get('amount') || 0)}`,
        recipient: r.get('recipient_email') || r.get('recipient') || null,
        status: String(r.get('status') || 'active'),
        created: String(r.get('created_at') || ''),
      }))

      const activeCards = giftCards.filter(c => c.status === 'active').length
      const totalBalance = allCards.reduce((s, r) => s + (Number(r.get('balance') || 0)), 0)

      const stats = [
        { label: 'Outstanding Balance', value: `$${totalBalance.toLocaleString()}` },
        { label: 'Active Cards', value: String(activeCards) },
        { label: 'Redeemed Today', value: '-' },
        { label: 'Sold This Month', value: '-' },
      ]

      return { giftCards, stats, denominations }
    }
    catch {
      return {
        giftCards: [],
        stats: [
          { label: 'Outstanding Balance', value: '$0' },
          { label: 'Active Cards', value: '0' },
          { label: 'Redeemed Today', value: '-' },
          { label: 'Sold This Month', value: '-' },
        ],
        denominations,
      }
    }
  },
})
