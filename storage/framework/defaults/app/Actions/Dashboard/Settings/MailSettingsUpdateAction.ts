import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'
import { dashboardOperationalError } from '../dashboard-response'
import { updateMailSettings } from './mail-settings'

export default new Action({
  name: 'MailSettingsUpdateAction',
  description: 'Validates and atomically updates mail environment settings.',
  method: 'PUT',
  apiResponse: true,

  async handle(request: RequestInstance) {
    let result
    try {
      result = await updateMailSettings(await request.all())
    }
    catch (error) {
      return dashboardOperationalError(error, 'Mail settings could not be saved.', 'MailSettingsUpdateAction', 500)
    }

    if ('validation' in result) {
      return response.json({
        message: 'Fix the mail settings validation errors before saving.',
        errors: result.validation.fields,
      }, 422)
    }
    if ('conflict' in result) {
      return response.json({
        message: 'The environment file changed on disk. Reload before saving your mail settings.',
      }, 409)
    }

    return Response.json(
      {
        success: true,
        settings: result.state,
      },
      { headers: { 'Cache-Control': 'no-store', Pragma: 'no-cache' } },
    )
  },
})
