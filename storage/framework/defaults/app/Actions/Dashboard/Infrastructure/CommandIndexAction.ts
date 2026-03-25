import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'CommandIndexAction',
  description: 'Returns command history data for the dashboard.',
  method: 'GET',
  async handle() {
    return {
      commands: [
        { name: 'migrate', description: 'Run database migrations', lastRun: '2024-01-10 10:30', status: 'success' },
        { name: 'seed', description: 'Seed the database', lastRun: '2024-01-10 10:31', status: 'success' },
        { name: 'cache:clear', description: 'Clear application cache', lastRun: '2024-01-10 09:15', status: 'success' },
        { name: 'queue:work', description: 'Process queue jobs', lastRun: 'Running', status: 'running' },
        { name: 'schedule:run', description: 'Run scheduled tasks', lastRun: '2024-01-10 10:00', status: 'success' },
      ],
    }
  },
})
