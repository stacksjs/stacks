import { Action } from '@stacksjs/actions/runtime'
import { anonymizedRows, GDPR_SUBJECT_MODEL, User } from '@stacksjs/orm'
import { safeGet } from '../../../../resources/functions/dashboard/data'
import { dashboardOperationalError } from '../dashboard-response'
import { dateValue, daysAgoIso, numberValue, textValue } from './data-records'

export default new Action({
  name: 'UserIndexAction',
  description: 'Returns a safe projection of users and native registration statistics.',
  method: 'GET',
  apiResponse: true,
  async handle() {
    try {
      const rows = await User.orderByDesc('created_at').limit(100).get()
      // An account erased under the app's data-subject rules stays in the
      // table with its personal details replaced. Listed as it is stored it
      // reads "[erased] / erased-13", which looks like corrupt data, so each
      // row says whether it is one and the page names it for what it is.
      const erased = await anonymizedRows(GDPR_SUBJECT_MODEL, rows.map(row => ({
        // As stored: an emptied column is NULL, and `safeGet` would otherwise
        // hand back its empty-string fallback, which is not what erasure wrote.
        id: safeGet(row, 'id', 0),
        name: safeGet(row, 'name', null),
        email: safeGet(row, 'email', null),
        avatar: safeGet(row, 'avatar', null),
      }))).catch((error) => {
        // The list is still worth showing when the rules cannot be read.
        console.warn('[dashboard/api] UserIndexAction: could not tell which users are anonymized:', error)
        return rows.map(() => false)
      })

      const users = rows.map((row, index) => ({
        id: numberValue(safeGet(row, 'id', 0)),
        name: textValue(safeGet(row, 'name'), 'Unnamed user'),
        email: textValue(safeGet(row, 'email')),
        anonymized: erased[index] === true,
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
      return dashboardOperationalError(error, 'Users could not be loaded.', 'UserIndexAction')
    }
  },
})
