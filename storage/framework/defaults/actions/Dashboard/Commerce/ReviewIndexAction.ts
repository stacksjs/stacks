import { Action } from '@stacksjs/actions'
import { Review } from '@stacksjs/orm'

export default new Action({
  name: 'ReviewIndexAction',
  description: 'Returns customer review data for the dashboard.',
  method: 'GET',
  async handle() {
    const items = await Review.orderBy('created_at', 'desc').limit(50).get()
    const count = await Review.count()

    const stats = [
      { label: 'Total Reviews', value: String(count) },
      { label: 'Avg Rating', value: '-' },
      { label: 'Pending', value: '-' },
      { label: 'Response Rate', value: '-' },
    ]

    const filters = ['All', 'Published', 'Pending', 'Flagged', '5\u2605', '4\u2605', '3\u2605', '2\u2605', '1\u2605']

    return {
      reviews: items.map(i => i.toJSON()),
      stats,
      filters,
    }
  },
})
