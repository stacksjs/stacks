import { Action } from '@stacksjs/actions'
import { config } from '@stacksjs/config'
import { buildDashboardSettings, type DashboardSettingsConfig } from './settings-summary'

export default new Action({
  name: 'SettingsIndexAction',
  description: 'Returns a safe summary of the active application configuration.',
  method: 'GET',
  apiResponse: true,
  async handle() {
    return buildDashboardSettings(config as DashboardSettingsConfig)
  },
})
