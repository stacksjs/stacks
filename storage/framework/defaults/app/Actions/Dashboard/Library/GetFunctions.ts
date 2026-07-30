import { Action } from '@stacksjs/actions'
import { functionSourceRows } from './library-source'

export default new Action({
  name: 'GetFunctions',
  description: 'Gets your utility functions.',
  method: 'GET',

  async handle() {
    const functions = functionSourceRows()

    return {
      functions,
      totalBytes: functions.reduce((sum, fn) => sum + fn.bytes, 0),
      sourceRoot: 'resources/functions',
    }
  },
})
