import { Action } from '@stacksjs/actions'
import { User } from '@stacksjs/orm'
import { safeGet } from '../../../../resources/functions/dashboard/data'
import { dateValue, daysAgoIso, numberValue, textValue } from './data-records'

export default new Action({
  name: 'UserIndexAction',
  description: 'Returns a safe projection of users and native registration statistics.',
  method: 'GET',
  apiResponse: true,
  async handle() {
    try {
      const rows = await User.orderByDesc('created_at').limit(100).get()
      const users = rows.map(row => ({
        id: numberValue(safeGet(row, 'id', 0)),
        name: textValue(safeGet(row, 'name'), 'Unnamed user'),
        email: textValue(safeGet(row, 'email')),
        emailVerifiedAt: dateValue(safeGet(row, 'email_verified_at', safeGet(row, 'emailVerifiedAt'))),
        createdAt: dateValue(safeGet(row, 'created_at', safeGet(row, 'createdAt'))),
        updatedAt: dateValue(safeGet(row, 'updated_at', safeGet(row, 'updatedAt'))),
      }))

      const [total, newThisWeek, verified] = await Promise.all([
        User.count(),
        User.where('created_at', '>=', daysAgoIso(7)).count(),
        User.whereNotNull('email_verified_at' as never).count(),
      ])

      return {
        users,
        stats: {
          total,
          newThisWeek,
          verified,
        },
      }
    }
    catch (error) {
      return {
        users: [],
        stats: { total: 0, newThisWeek: 0, verified: 0 },
        error: error instanceof Error ? error.message : 'Users could not be loaded.',
      }
    }
  },
})
