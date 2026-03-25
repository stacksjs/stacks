import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'DeviceAnalyticsAction',
  description: 'Returns device and OS analytics data for the dashboard.',
  method: 'GET',
  async handle() {
    // TODO: replace with model query when available
    return {
      devices: [
        { name: 'Desktop', sessions: 6234, percentage: 62.3 },
        { name: 'Mobile', sessions: 2876, percentage: 28.8 },
        { name: 'Tablet', sessions: 890, percentage: 8.9 },
      ],
      os: [
        { name: 'macOS', sessions: 3421, percentage: 34.2 },
        { name: 'Windows', sessions: 2876, percentage: 28.8 },
        { name: 'iOS', sessions: 1654, percentage: 16.5 },
        { name: 'Android', sessions: 1234, percentage: 12.3 },
        { name: 'Linux', sessions: 815, percentage: 8.2 },
      ],
    }
  },
})
