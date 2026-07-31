import { Action } from '@stacksjs/actions'
import { PrintDevice } from '@stacksjs/orm'
import { response } from '@stacksjs/router'
import { normalizePrintDeviceRecord, summarizePrintDevices } from './print-device-records'

export default new Action({
  name: 'CommercePrintDevicesAction',
  description: 'Returns persisted PrintDevice records for dashboard management.',
  method: 'GET',
  apiResponse: true,

  async handle() {
    try {
      const devices = await PrintDevice.orderByDesc('id').limit(500).get()
      const records = devices.map(normalizePrintDeviceRecord)
      return {
        records,
        summary: summarizePrintDevices(records),
      }
    }
    catch (error) {
      return response.json({
        message: error instanceof Error ? error.message : 'Print device records could not be read.',
      }, 503)
    }
  },
})
