import { Action } from '@stacksjs/actions'
import { errors } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Error Show',
  description: 'Fetch a single error by ID',
  method: 'GET',
  async handle(request: RequestInstance) {
    // `getParamAsInt` returns null for a param that is not an integer, which
    // is a bad request rather than a lookup for id `null`.
    const id = request.getParamAsInt('id')
    if (id === null)
      return response.json({ error: 'A numeric error id is required' }, 422)

    const result = await errors.fetchById(id)

    if (!result) {
      return response.json({ error: 'Error not found' }, 404)
    }

    return response.json({ data: result })
  },
})
