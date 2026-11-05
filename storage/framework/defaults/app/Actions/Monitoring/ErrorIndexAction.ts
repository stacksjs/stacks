import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions/runtime'
import { response } from '@stacksjs/router'
import { parseErrorGroupQuery, readGroupedErrors } from './error-provider'

export default new Action({
  name: 'Error Index',
  description: 'Fetch one page of grouped errors (Sentry-like aggregation)',
  method: 'GET',
  async handle(request: RequestInstance) {
    const query = parseErrorGroupQuery(key => request.get<unknown>(key, ''))
    if ('error' in query)
      return response.json({ message: query.error }, 422)

    return response.json(await readGroupedErrors(query))
  },
})
