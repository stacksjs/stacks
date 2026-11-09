import { Action } from '@stacksjs/actions/runtime'
import { dashboardOperationalError } from '../dashboard-response'
import { readPrintDevices } from './commerce-print-device-list'

/**
 * `GET /api/dashboard/commerce/print-devices` - every print device, read whole (commerce-print-device-list.ts,
 * stacksjs/stacks#3218). This used to send the newest 500.
 */
export default new Action({
  name: 'CommercePrintDevicesAction',
  description: 'Returns every persisted PrintDevice record for dashboard management.',
  method: 'GET',
  apiResponse: true,

  async handle() {
    try {
      return await readPrintDevices()
    }
    catch (error) {
      return dashboardOperationalError(error, 'Print device records could not be read.', 'CommercePrintDevicesAction')
    }
  },
})
