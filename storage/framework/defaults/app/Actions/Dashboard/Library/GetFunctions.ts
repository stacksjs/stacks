import { Action } from '@stacksjs/actions'
import { dashboardOperationalError } from '../dashboard-response'
import { functionSourceRows } from './library-source'

export default new Action({
  name: 'GetFunctions',
  description: 'Gets your utility functions.',
  method: 'GET',
  apiResponse: true,

  async handle() {
    try {
      const functions = functionSourceRows()

      return {
        functions,
        totalBytes: functions.reduce((sum, fn) => sum + fn.bytes, 0),
        sourceRoot: 'resources/functions',
      }
    }
    catch (error) {
      return dashboardOperationalError(error, 'Function library could not be loaded.', 'GetFunctions')
    }
  },
})
