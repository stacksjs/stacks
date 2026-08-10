import { Action } from '@stacksjs/actions'
import { Activity } from '@stacksjs/orm'
import { safeGet } from '../../../../resources/functions/dashboard/data'
import { dashboardOperationalError } from '../dashboard-response'
import { dateValue, daysAgoIso, numberValue, textValue } from './data-records'

export default new Action({
  name: 'ActivityIndexAction',
  description: 'Returns a safe projection of recent activity for the dashboard.',
  method: 'GET',
  apiResponse: true,
  async handle() {
    try {
      const rows = await Activity.orderByDesc('created_at').limit(100).get()
      const activities = rows.map(row => ({
        id: numberValue(safeGet(row, 'id', 0)),
        type: textValue(safeGet(row, 'type')),
        description: textValue(safeGet(row, 'description')),
        subjectType: textValue(safeGet(row, 'subject_type', safeGet(row, 'subjectType'))),
        subjectId: numberValue(safeGet(row, 'subject_id', safeGet(row, 'subjectId', 0))),
        causer: textValue(safeGet(row, 'causer'), 'System'),
        createdAt: dateValue(safeGet(row, 'created_at', safeGet(row, 'createdAt'))),
      }))

      const [total, last24Hours, last7Days] = await Promise.all([
        Activity.count(),
        Activity.where('created_at', '>=', daysAgoIso(1)).count(),
        Activity.where('created_at', '>=', daysAgoIso(7)).count(),
      ])

      return {
        activities,
        stats: {
          total,
          last24Hours,
          last7Days,
        },
      }
    }
    catch (error) {
      return dashboardOperationalError(error, 'Activity could not be loaded.', 'ActivityIndexAction')
    }
  },
})
