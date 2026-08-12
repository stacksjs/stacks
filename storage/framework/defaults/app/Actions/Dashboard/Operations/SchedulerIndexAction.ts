import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { dashboardOperationalError } from '../dashboard-response'
import { recentOperatorOperations } from './control-plane'
import { listSchedulerTasks } from './scheduler-operations'

export default new Action({
  name: 'SchedulerIndexAction',
  description: 'Lists registered scheduled tasks and their durable operator history.',
  method: 'GET',
  apiResponse: true,
  async handle(_request: RequestInstance) {
    try {
      const tasks = await listSchedulerTasks()
      const operations = recentOperatorOperations('dashboard.scheduler.', 20)
      return {
        tasks,
        operations,
        summary: {
          total: tasks.length,
          active: tasks.filter(task => task.enabled).length,
          paused: tasks.filter(task => !task.enabled).length,
          nextRun: tasks
            .map(task => task.nextRun)
            .filter((value): value is string => Boolean(value))
            .sort()[0] || null,
        },
      }
    }
    catch (error) {
      return dashboardOperationalError(error, 'Scheduler operations could not be loaded.', 'SchedulerIndexAction')
    }
  },
})
