import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'UserIndexAction',
  description: 'Returns user data for the dashboard.',
  method: 'GET',
  async handle() {
    return {
      data: [
        { id: 1, name: 'Chris Breuer', email: 'chris@stacks.dev', role: 'Admin', status: 'Active', lastLogin: '2 hours ago', createdAt: '2024-01-01' },
        { id: 2, name: 'Jane Smith', email: 'jane@example.com', role: 'Editor', status: 'Active', lastLogin: '1 day ago', createdAt: '2024-02-15' },
        { id: 3, name: 'John Doe', email: 'john@example.com', role: 'User', status: 'Active', lastLogin: '3 days ago', createdAt: '2024-03-01' },
      ],
      total: 1247,
    }
  },
})
