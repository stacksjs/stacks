import { Action } from '@stacksjs/actions'
import { Activity } from '@stacksjs/orm'
import { safeGet } from '../../../resources/functions/dashboard/data'
import { dateValue, numberValue, textValue } from './Data/data-records'

export function activityStatus(type: string): 'success' | 'warning' {
  const normalized = type.toLowerCase()
  return normalized.includes('failed')
    || normalized.includes('error')
    || normalized.includes('cancelled')
    || normalized.includes('deleted')
    ? 'warning'
    : 'success'
}

export default new Action({
  name: 'Dashboard Activity',
  description: 'Fetch recent persisted activity for dashboard',
  method: 'GET',

  async handle() {
    try {
      const rows = await Activity.orderByDesc('created_at').limit(20).get()
      const activity = rows.map((row) => {
        const type = textValue(safeGet(row, 'type'), 'activity')
        return {
          id: numberValue(safeGet(row, 'id')),
          type,
          title: textValue(safeGet(row, 'description'), type),
          time: dateValue(safeGet(row, 'created_at', safeGet(row, 'createdAt'))),
          status: activityStatus(type),
        }
      })

      return { activity, count: activity.length }
    }
    catch (error) {
      return {
        activity: [],
        count: 0,
        error: error instanceof Error ? error.message : 'Activity records could not be loaded.',
      }
    }
  },
})
