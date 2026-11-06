import { Action } from '@stacksjs/actions/runtime'
import { Courier, User } from '@stacksjs/orm'
import { dashboardOperationalError } from '../dashboard-response'
import { indexCourierUsers, normalizeCourierRecord } from './courier-records'

export default new Action({
  name: 'Dashboard Couriers',
  description: 'Returns validated couriers and their optional User relationships.',
  method: 'GET',
  apiResponse: true,

  async handle() {
    try {
      // Read whole: store configuration, which the page searches in full. The
      // first 500 left the rest unlisted and unsearchable (stacksjs/stacks#3218).
      const couriers = await Courier.orderBy('name', 'asc').get()
      const userIds = [...new Set(couriers.map(courier => courier.get('user_id')).filter(Boolean))]
      const users = userIds.length ? await User.whereIn('id', userIds).get() : []
      const usersById = indexCourierUsers(users)
      return couriers.map(courier => normalizeCourierRecord(courier, usersById))
    }
    catch (error) {
      return dashboardOperationalError(error, 'Courier records could not be read.', 'CourierIndexAction')
    }
  },
})
