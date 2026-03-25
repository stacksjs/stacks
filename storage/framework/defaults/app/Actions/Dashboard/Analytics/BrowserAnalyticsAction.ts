import { Action } from '@stacksjs/actions'

// TODO: integrate with analytics provider (Fathom/Plausible)
export default new Action({
  name: 'BrowserAnalyticsAction',
  description: 'Returns browser analytics data for the dashboard.',
  method: 'GET',
  async handle() {
    return {
      browsers: [
        { name: 'Chrome', sessions: 5432, percentage: 54.3, version: '122.0' },
        { name: 'Safari', sessions: 2134, percentage: 21.3, version: '17.3' },
        { name: 'Firefox', sessions: 1234, percentage: 12.3, version: '123.0' },
        { name: 'Edge', sessions: 876, percentage: 8.8, version: '122.0' },
        { name: 'Other', sessions: 324, percentage: 3.2, version: 'N/A' },
      ],
    }
  },
})
