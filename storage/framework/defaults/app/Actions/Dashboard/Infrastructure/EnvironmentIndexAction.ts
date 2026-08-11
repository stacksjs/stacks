import { Action } from '@stacksjs/actions'
import { dashboardOperationalError } from '../dashboard-response'
import { readEnvironmentFile } from './environment-file'

export default new Action({
  name: 'EnvironmentIndexAction',
  description: 'Returns the project environment file and its latest dashboard backup.',
  method: 'GET',
  apiResponse: true,

  async handle() {
    try {
      return Response.json(
        { environment: await readEnvironmentFile() },
        { headers: { 'Cache-Control': 'no-store', Pragma: 'no-cache' } },
      )
    }
    catch (error) {
      return dashboardOperationalError(error, 'Environment file could not be loaded.', 'EnvironmentIndexAction')
    }
  },
})
