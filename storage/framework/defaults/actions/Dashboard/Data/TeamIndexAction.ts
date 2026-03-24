import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'TeamIndexAction',
  description: 'Returns team data for the dashboard.',
  method: 'GET',
  async handle() {
    return {
      data: [
        { id: 1, name: 'Engineering', memberCount: 8, owner: 'Chris Breuer', createdAt: '2024-01-01' },
        { id: 2, name: 'Design', memberCount: 4, owner: 'Jane Smith', createdAt: '2024-02-15' },
        { id: 3, name: 'Marketing', memberCount: 6, owner: 'John Doe', createdAt: '2024-03-01' },
      ],
    }
  },
})
