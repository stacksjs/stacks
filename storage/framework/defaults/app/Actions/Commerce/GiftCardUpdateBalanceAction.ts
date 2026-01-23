import { Action } from '@stacksjs/actions'
import { giftCards } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Update Gift Card Balance',
  description: 'Update the balance of a gift card',
  method: 'POST',

  async handle({ request }) {
    const { id, amount } = request.all()

    if (!id || !amount) {
      return response.json({
        error: 'Missing required fields: id and amount are required',
      }, 400)
    }

    try {
      const updatedGiftCard = await giftCards.updateBalance(id, amount)

      return response.json({
        gift_card: updatedGiftCard,
      })
    }
    catch (error) {
      if (error instanceof Error) {
        return response.json({
          error: error.message,
        }, 400)
      }

      throw error
    }
  },
})
