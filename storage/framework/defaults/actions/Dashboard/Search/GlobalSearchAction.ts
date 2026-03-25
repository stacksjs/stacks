import { Action } from '@stacksjs/actions'
import { User, Post, Product } from '@stacksjs/orm'

export default new Action({
  name: 'GlobalSearchAction',
  description: 'Returns global search results grouped by model.',
  method: 'GET',
  async handle() {
    const users = await User.orderBy('created_at', 'desc').limit(5).get()
    const posts = await Post.orderBy('created_at', 'desc').limit(5).get()
    const products = await Product.orderBy('created_at', 'desc').limit(5).get()

    return {
      results: {
        users: users.map(i => i.toJSON()),
        posts: posts.map(i => i.toJSON()),
        products: products.map(i => i.toJSON()),
      },
    }
  },
})
