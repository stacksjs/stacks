import { Action } from '@stacksjs/actions'
import { readEnvironmentFile } from './environment-file'

export default new Action({
  name: 'EnvironmentIndexAction',
  description: 'Returns the project environment file and its latest dashboard backup.',
  method: 'GET',
  apiResponse: true,

  async handle() {
    return Response.json(
      { environment: await readEnvironmentFile() },
      { headers: { 'Cache-Control': 'no-store', Pragma: 'no-cache' } },
    )
  },
})
