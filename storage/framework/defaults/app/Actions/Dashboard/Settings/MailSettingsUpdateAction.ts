import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'
import { updateMailSettings } from './mail-settings'

export default new Action({
  name: 'MailSettingsUpdateAction',
  description: 'Validates and atomically updates mail environment settings.',
  method: 'PUT',
  apiResponse: true,

  async handle(request: RequestInstance) {
    const result = await updateMailSettings(await request.all())

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
