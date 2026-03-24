import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'ListIndexAction',
  description: 'Returns mailing list data for the dashboard.',
  method: 'GET',
  async handle() {
    return {
      data: [
        { id: 1, name: 'Newsletter Subscribers', subscriberCount: 8934, growthRate: '2.3%', createdAt: '2024-01-01' },
        { id: 2, name: 'Product Updates', subscriberCount: 5432, growthRate: '1.8%', createdAt: '2024-02-15' },
        { id: 3, name: 'Beta Testers', subscriberCount: 1234, growthRate: '5.2%', createdAt: '2024-03-01' },
      ],
    }
  },
})
