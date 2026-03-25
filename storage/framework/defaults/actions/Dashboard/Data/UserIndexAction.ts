import { Action } from '@stacksjs/actions'
import { User } from '@stacksjs/orm'

export default new Action({
  name: 'UserIndexAction',
  description: 'Returns user data for the dashboard.',
  method: 'GET',
  async handle() {
    const items = await User.orderBy('created_at', 'desc').limit(50).get()
    const count = await User.count()
    const roles = ['All Roles', 'Admin', 'Editor', 'Author', 'Subscriber', 'User']

    const stats = [
      { label: 'Total Users', value: String(count) },
      { label: 'Active Today', value: '-' },
      { label: 'New This Week', value: '-' },
    ]

    return {
      users: items.map(i => i.toJSON()),
      stats,
      roles,
    }
  },
})
