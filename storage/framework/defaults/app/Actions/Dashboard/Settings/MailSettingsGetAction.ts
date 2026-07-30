import { Action } from '@stacksjs/actions'
import { readMailSettings } from './mail-settings'

export default new Action({
  name: 'MailSettingsGetAction',
  description: 'Returns mail settings without exposing stored credentials.',
  method: 'GET',
  apiResponse: true,

  async handle() {
    return Response.json(
      { settings: await readMailSettings() },
      { headers: { 'Cache-Control': 'no-store', Pragma: 'no-cache' } },
    )
  },
})
