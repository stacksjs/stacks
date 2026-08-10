import { Action } from '@stacksjs/actions'
import { Driver, User } from '@stacksjs/orm'
import { dashboardOperationalError } from '../dashboard-response'
import { indexDriverUsers, normalizeDriverRecord } from './driver-records'

export default new Action({
  name: 'Dashboard Drivers',
  description: 'Returns validated drivers and their optional User relationships.',
  method: 'GET',
  apiResponse: true,

  async handle() {
    try {
      const drivers = await Driver.orderBy('name', 'asc').limit(500).get()
      const userIds = [...new Set(drivers.map(driver => driver.get('user_id')).filter(Boolean))]
      const users = userIds.length ? await User.where('id', 'in', userIds).get() : []
      const usersById = indexDriverUsers(users)
      return drivers.map(driver => normalizeDriverRecord(driver, usersById))
    }
    catch (error) {
      return dashboardOperationalError(error, 'Driver records could not be read.', 'DriverIndexAction')
    }
  },
})
