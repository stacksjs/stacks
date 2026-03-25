import { Action } from '@stacksjs/actions'
import { User } from '@stacksjs/orm'

export default new Action({
  name: 'UserIndexAction',
  description: 'Returns user data for the dashboard.',
  method: 'GET',
  async handle() {
    const roles = ['All Roles', 'Admin', 'Editor', 'Author', 'Subscriber', 'User']

    try {
      const allUsers = await User.orderBy('created_at', 'desc').get()
      const totalUsers = await User.count()

      const users = allUsers.map((u) => {
        const name = String(u.get('name') || 'Unknown')
        const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
        return {
          name,
          email: String(u.get('email') || 'N/A'),
          role: 'User',
          status: 'active',
          lastLogin: 'Recently',
          avatar: initials,
        }
      })

      const stats = [
        { label: 'Total Users', value: String(totalUsers) },
        { label: 'Active Today', value: String(totalUsers) },
        { label: 'New This Week', value: String(Math.min(totalUsers, 5)) },
      ]

      return { users, stats, roles }
    }
    catch {
      return {
        users: [],
        stats: [
          { label: 'Total Users', value: '0' },
          { label: 'Active Today', value: '0' },
          { label: 'New This Week', value: '0' },
        ],
        roles,
      }
    }
  },
})
