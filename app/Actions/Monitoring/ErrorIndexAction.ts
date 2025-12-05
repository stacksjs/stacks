import { Action } from '@stacksjs/actions'
import { errors } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Error Index',
  description: 'Fetch all grouped errors (Sentry-like aggregation)',
  method: 'GET',
  async handle() {
    const results = await errors.fetchGrouped()

    return response.json({ data: results })
  },
})
