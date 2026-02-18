import { Action } from '@stacksjs/actions'
import { errors } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Error Show',
  description: 'Fetch a single error by ID',
  method: 'GET',
  async handle(request: RequestInstance) {
    const id = request.getParamAsInt('id')
    const result = await errors.fetchById(id)

    if (!result) {
      return response.json({ error: 'Error not found' }, 404)
    }

    return response.json({ data: result })
  },
})
