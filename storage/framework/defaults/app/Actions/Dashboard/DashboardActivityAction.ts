import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'Dashboard Activity',
  description: 'Fetch recent activity for dashboard',
  method: 'GET',

  async handle() {
    // Mock data for development - replace with actual ORM queries when database is set up
    const activity = [
      {
        id: 1,
        type: 'deployment',
        title: 'Deployment completed successfully',
        time: '5 minutes ago',
        status: 'success' as const,
      },
      {
        id: 2,
        type: 'commerce',
        title: 'New order #1234 received',
        time: '15 minutes ago',
        status: 'success' as const,
      },
      {
        id: 3,
        type: 'blog',
        title: 'Blog post "Getting Started" published',
        time: '30 minutes ago',
        status: 'success' as const,
      },
      {
        id: 4,
        type: 'error',
        title: 'Error: Connection timeout in payments',
        time: '45 minutes ago',
        status: 'warning' as const,
      },
      {
        id: 5,
        type: 'deployment',
        title: 'Staging deployment started',
        time: '1 hour ago',
        status: 'success' as const,
      },
      {
        id: 6,
        type: 'commerce',
        title: 'New order #1233 received',
        time: '2 hours ago',
        status: 'success' as const,
      },
    ]

    // Return the activity directly - the router will handle JSON serialization
    return { activity }
  },
})
