import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'ActivityIndexAction',
  description: 'Returns recent activity data for the dashboard.',
  method: 'GET',
  async handle() {
    return {
      data: [
        { id: 1, type: 'user', action: 'Created new user account', user: 'Chris Breuer', timestamp: new Date(Date.now() - 3600000).toISOString() },
        { id: 2, type: 'deployment', action: 'Deployed v0.72.0 to production', user: 'CI/CD', timestamp: new Date(Date.now() - 7200000).toISOString() },
        { id: 3, type: 'commerce', action: 'New order #1234 placed', user: 'Customer', timestamp: new Date(Date.now() - 10800000).toISOString() },
        { id: 4, type: 'content', action: 'Published blog post "Getting Started"', user: 'Jane Smith', timestamp: new Date(Date.now() - 14400000).toISOString() },
        { id: 5, type: 'system', action: 'Database backup completed', user: 'System', timestamp: new Date(Date.now() - 18000000).toISOString() },
      ],
    }
  },
})
