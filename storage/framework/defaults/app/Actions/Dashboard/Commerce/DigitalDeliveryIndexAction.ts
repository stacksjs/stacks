import { Action } from '@stacksjs/actions'
import { DigitalDelivery } from '@stacksjs/orm'
import { response } from '@stacksjs/router'
import { normalizeDigitalDeliveryRecord } from './digital-delivery-records'

export default new Action({
  name: 'Dashboard Digital Deliveries',
  description: 'Returns validated digital delivery settings for the dashboard.',
  method: 'GET',
  apiResponse: true,

  async handle() {
    try {
      const records = await DigitalDelivery.orderByDesc('id').limit(500).get()
      return records.map(normalizeDigitalDeliveryRecord)
    }
    catch (error) {
      return response.json({
        message: error instanceof Error ? error.message : 'Digital delivery records could not be read.',
      }, 503)
    }
  },
})
