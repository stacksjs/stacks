import { Action } from '@stacksjs/actions'
import { giftCards } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Gift Card Statistics',
  description: 'Fetch gift card statistics for a given time period',
  method: 'GET',

  async handle() {
    const [stats, totalValue, totalBalance] = await Promise.all([
      giftCards.compareActiveGiftCards(30), // Default to 30 days
      giftCards.fetchTotalValue(),
      giftCards.fetchTotalCurrentBalance(),
    ])

    return response.json({
      active_gift_cards: {
        count: stats.current_period,
        comparison: {
          difference: stats.difference,
          percentage: stats.percentage_change,
          is_increase: stats.difference >= 0,
        },
      },
      total_value: totalValue,
      current_balance: totalBalance,
    })
  },
})
