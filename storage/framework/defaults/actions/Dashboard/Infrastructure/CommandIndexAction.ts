import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'CommandIndexAction',
  description: 'Returns command history data for the dashboard.',
  method: 'GET',
  async handle() {
    return {
      data: [
        { name: 'buddy dev', description: 'Start development server', lastRun: '2 min ago', avgTime: '0.3s', status: 'success' },
        { name: 'buddy build', description: 'Build for production', lastRun: '1 hour ago', avgTime: '12.5s', status: 'success' },
        { name: 'buddy deploy', description: 'Deploy to cloud', lastRun: '3 hours ago', avgTime: '45.2s', status: 'success' },
        { name: 'buddy migrate', description: 'Run migrations', lastRun: '1 day ago', avgTime: '2.1s', status: 'success' },
        { name: 'buddy seed', description: 'Seed database', lastRun: '1 day ago', avgTime: '5.3s', status: 'failed' },
      ],
      total: 52,
    }
  },
})
