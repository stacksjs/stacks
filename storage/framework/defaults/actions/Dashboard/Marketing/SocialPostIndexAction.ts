import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'SocialPostIndexAction',
  description: 'Returns social media post data for the dashboard.',
  method: 'GET',
  async handle() {
    return {
      data: [
        { id: 1, platform: 'Twitter/X', content: 'Excited to announce Stacks v0.72!', status: 'published', likes: 234, shares: 56, publishedAt: '2024-03-15' },
        { id: 2, platform: 'LinkedIn', content: 'New blog post: Building with TypeScript', status: 'published', likes: 123, shares: 34, publishedAt: '2024-03-14' },
        { id: 3, platform: 'Twitter/X', content: 'Check out our new docs!', status: 'scheduled', likes: 0, shares: 0, publishedAt: '2024-03-20' },
      ],
    }
  },
})
