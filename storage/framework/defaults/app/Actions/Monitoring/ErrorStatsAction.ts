import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'
import { readErrorStats } from './error-provider'

export default new Action({
  name: 'Error Stats',
  description: 'Fetch error statistics',
  method: 'GET',
  async handle() {
    return response.json(await readErrorStats())
  },
})
