import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'
import { dashboardOperationalError } from '../dashboard-response'
import { updateEnvironmentFile } from './environment-file'

export default new Action({
  name: 'EnvironmentUpdateAction',
  description: 'Validates and atomically updates the project environment file.',
  method: 'PUT',
  apiResponse: true,

  async handle(request: RequestInstance) {
    const content = request.get('content')
    const revision = request.get('revision')

    if (typeof content !== 'string')
      return response.json({ message: 'Environment content must be a string.' }, 422)
    if (typeof revision !== 'string' || !/^[a-f0-9]{64}$/.test(revision))
      return response.json({ message: 'A valid environment revision is required.' }, 422)

    let result
    try {
      result = await updateEnvironmentFile(content, revision)
    }
    catch (error) {
      return dashboardOperationalError(error, 'Environment file could not be saved.', 'EnvironmentUpdateAction', 500)
    }
    if (result.issues?.length) {
      const errors = Object.fromEntries(result.issues.map((issue, index) => [
        issue.line ? String(issue.line) : `file-${index}`,
        issue.message,
      ]))
      return response.json({
        message: 'Fix the environment file validation errors before saving.',
        errors,
      }, 422)
    }
    if (result.conflict) {
      return response.json({
        message: 'The environment file changed on disk. Reload before saving your edits.',
      }, 409)
    }

    return Response.json(
      {
        success: true,
        environment: result.state,
      },
      { headers: { 'Cache-Control': 'no-store', Pragma: 'no-cache' } },
    )
  },
})
