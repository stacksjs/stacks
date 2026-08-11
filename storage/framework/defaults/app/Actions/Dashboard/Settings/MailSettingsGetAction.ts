import { Action } from '@stacksjs/actions'
import { dashboardOperationalError } from '../dashboard-response'
import { readMailSettings } from './mail-settings'

export default new Action({
  name: 'MailSettingsGetAction',
  description: 'Returns mail settings without exposing stored credentials.',
  method: 'GET',
  apiResponse: true,

  async handle() {
    try {
      return Response.json(
        { settings: await readMailSettings() },
        { headers: { 'Cache-Control': 'no-store', Pragma: 'no-cache' } },
      )
    }
    catch (error) {
      return dashboardOperationalError(error, 'Mail settings could not be loaded.', 'MailSettingsGetAction')
    }
  },
})
