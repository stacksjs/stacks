import { Action } from '@stacksjs/actions'
import { Review } from '@stacksjs/orm'

export default new Action({
  name: 'ReviewIndexAction',
  description: 'Returns customer review data for the dashboard.',
  method: 'GET',
  async handle() {
    const filters = ['All', 'Published', 'Pending', 'Flagged', '5*', '4*', '3*', '2*', '1*']

    try {
      const allReviews = await Review.orderByDesc('id').get()
      const totalReviews = await Review.count()

      const reviews = allReviews.map(r => ({
        product: String(r.get('product_name') || r.get('title') || ''),
        author: String(r.get('author') || r.get('reviewer_name') || ''),
        rating: Number(r.get('rating') || 0),
        comment: String(r.get('comment') || r.get('body') || ''),
        status: String(r.get('status') || 'pending'),
        date: String(r.get('created_at') || ''),
      }))

      const avgRating = reviews.length > 0
        ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
        : '0'
      const pendingCount = reviews.filter(r => r.status === 'pending').length

      const stats = [
        { label: 'Total Reviews', value: String(totalReviews) },
        { label: 'Avg Rating', value: `${avgRating}*` },
        { label: 'Pending', value: String(pendingCount) },
        { label: 'Response Rate', value: '-' },
      ]

      return { reviews, stats, filters }
    }
    catch {
      return {
        reviews: [],
        stats: [
          { label: 'Total Reviews', value: '0' },
          { label: 'Avg Rating', value: '0*' },
          { label: 'Pending', value: '0' },
          { label: 'Response Rate', value: '-' },
        ],
        filters,
      }
    }
  },
})
