import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'
import { readGroupedErrors } from './error-provider'

export default new Action({
  name: 'Error Index',
  description: 'Fetch all grouped errors (Sentry-like aggregation)',
  method: 'GET',
  async handle() {
    return response.json(await readGroupedErrors())
  },
})
