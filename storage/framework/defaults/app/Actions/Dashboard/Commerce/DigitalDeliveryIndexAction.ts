import { Action } from '@stacksjs/actions/runtime'
import { DigitalDelivery } from '@stacksjs/orm'
import { dashboardOperationalError } from '../dashboard-response'
import { normalizeDigitalDeliveryRecord } from './digital-delivery-records'

export default new Action({
  name: 'Dashboard Digital Deliveries',
  description: 'Returns validated digital delivery settings for the dashboard.',
  method: 'GET',
  apiResponse: true,

  async handle() {
    try {
      // Read whole: store configuration, which the page searches in full. The
      // first 500 left the rest unlisted and unsearchable (stacksjs/stacks#3218).
      const records = await DigitalDelivery.orderByDesc('id').get()
      return records.map(normalizeDigitalDeliveryRecord)
    }
    catch (error) {
      return dashboardOperationalError(error, 'Digital delivery records could not be read.', 'DigitalDeliveryIndexAction')
    }
  },
})
