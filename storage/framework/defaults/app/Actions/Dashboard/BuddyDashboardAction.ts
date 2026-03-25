import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'BuddyDashboardAction',
  description: 'Returns Buddy CLI dashboard data including commands, output, and stats.',
  method: 'GET',
  async handle() {
    const commands = [
      { command: 'buddy build', description: 'Build the application', lastRun: '5m ago', status: 'success' },
      { command: 'buddy dev', description: 'Start development server', lastRun: 'Running', status: 'running' },
      { command: 'buddy test', description: 'Run test suite', lastRun: '1h ago', status: 'success' },
      { command: 'buddy lint', description: 'Run linter', lastRun: '30m ago', status: 'success' },
      { command: 'buddy deploy', description: 'Deploy to production', lastRun: '2d ago', status: 'success' },
      { command: 'buddy migrate', description: 'Run database migrations', lastRun: '1d ago', status: 'success' },
    ]

    const recentOutput = `[14:32:45] Starting development server...
[14:32:46] Compiling TypeScript...
[14:32:48] Compiled successfully in 2.3s
[14:32:48] Server running at http://localhost:3000
[14:32:48] Hot reload enabled
[14:32:50] Connected to database
[14:32:50] Ready for requests`

    const stats = [
      { label: 'Commands Run', value: '1,234' },
      { label: 'Avg Build Time', value: '2.3s' },
      { label: 'Test Coverage', value: '89%' },
      { label: 'Last Deploy', value: '2d ago' },
    ]

    return { commands, recentOutput, stats }
  },
})
