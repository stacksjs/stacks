import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'GlobalSearchAction',
  description: 'Returns global search results grouped by model.',
  method: 'GET',
  async handle(request: RequestInstance) {
    const q = request?.get('q') || ''

    if (!q) return { results: {} }

    return {
      results: {
        users: [
          { id: 1, title: 'Chris Breuer', subtitle: 'chris@stacks.dev', href: '/data/users', icon: 'i-hugeicons-user-02' },
        ],
        posts: [
          { id: 1, title: 'Getting Started with Stacks', subtitle: 'Published 2 days ago', href: '/content/posts', icon: 'i-hugeicons-note-edit' },
        ],
        products: [
          { id: 1, title: 'Premium Plan', subtitle: '$99/mo', href: '/commerce/products', icon: 'i-hugeicons-shopping-bag-02' },
        ],
      },
    }
  },
})
