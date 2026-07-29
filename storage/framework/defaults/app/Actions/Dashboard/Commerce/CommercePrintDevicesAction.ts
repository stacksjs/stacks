import { Action } from '@stacksjs/actions'
import { PrintDevice } from '@stacksjs/orm'
import { normalizePrintDeviceRecord, summarizePrintDevices } from './print-device-records'

export default new Action({
  name: 'CommercePrintDevicesAction',
  description: 'Returns persisted PrintDevice records for dashboard management.',
  method: 'GET',
  apiResponse: true,

  async handle() {
    const devices = await PrintDevice.orderByDesc('id').limit(500).get()
    const records = devices.map(normalizePrintDeviceRecord)
    return {
      records,
      summary: summarizePrintDevices(records),
    }
  },
})
