import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions/runtime'
import { response } from '@stacksjs/router'
import { dashboardOperationalError } from '../dashboard-response'
import { readEnvironmentPage } from './environment-page'

export default new Action({
  name: 'EnvironmentIndexAction',
  description: 'Returns one of the env files the app loads, its latest dashboard backup, and the keys a later file overrides.',
  method: 'GET',
  apiResponse: true,

  async handle(request: RequestInstance) {
    try {
      const page = await readEnvironmentPage(request.get('file'))
      if (!page)
        return response.json({ message: 'That is not one of the env files this app loads.' }, 404)
      return Response.json(page, { headers: { 'Cache-Control': 'no-store', Pragma: 'no-cache' } })
    }
    catch (error) {
      return dashboardOperationalError(error, 'Environment file could not be loaded.', 'EnvironmentIndexAction')
    }
  },
})
