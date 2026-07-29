import { Action } from '@stacksjs/actions'
import { Team } from '@stacksjs/orm'
import { safeGet } from '../../../../resources/functions/dashboard/data'
import { dateValue, daysAgoIso, numberValue, textValue } from './data-records'

export default new Action({
  name: 'TeamIndexAction',
  description: 'Returns teams and native team statistics for the dashboard.',
  method: 'GET',
  apiResponse: true,
  async handle() {
    try {
      const rows = await Team.orderByDesc('created_at').limit(100).get()
      const teams = rows.map(row => ({
        id: numberValue(safeGet(row, 'id', 0)),
        name: textValue(safeGet(row, 'name'), 'Unnamed team'),
        description: textValue(safeGet(row, 'description')),
        memberCount: numberValue(safeGet(row, 'member_count', safeGet(row, 'memberCount', 0))),
        status: textValue(safeGet(row, 'status'), 'inactive'),
        createdAt: dateValue(safeGet(row, 'created_at', safeGet(row, 'createdAt'))),
        updatedAt: dateValue(safeGet(row, 'updated_at', safeGet(row, 'updatedAt'))),
      }))

      const [total, active, members, newThisMonth] = await Promise.all([
        Team.count(),
        Team.where('status', 'active').count(),
        Team.sum('memberCount'),
        Team.where('created_at', '>=', daysAgoIso(30)).count(),
      ])

      return {
        teams,
        stats: {
          total,
          active,
          members,
          newThisMonth,
        },
      }
    }
    catch (error) {
      return {
        teams: [],
        stats: { total: 0, active: 0, members: 0, newThisMonth: 0 },
        error: error instanceof Error ? error.message : 'Teams could not be loaded.',
      }
    }
  },
})
