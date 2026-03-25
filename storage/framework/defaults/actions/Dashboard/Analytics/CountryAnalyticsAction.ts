import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'CountryAnalyticsAction',
  description: 'Returns country analytics data for the dashboard.',
  method: 'GET',
  async handle() {
    // TODO: replace with model query when available
    return {
      countries: [
        { name: 'United States', visitors: 4521, percentage: 45.2, flag: 'US' },
        { name: 'United Kingdom', visitors: 1234, percentage: 12.3, flag: 'GB' },
        { name: 'Germany', visitors: 987, percentage: 9.9, flag: 'DE' },
        { name: 'Canada', visitors: 876, percentage: 8.8, flag: 'CA' },
        { name: 'France', visitors: 654, percentage: 6.5, flag: 'FR' },
        { name: 'Australia', visitors: 543, percentage: 5.4, flag: 'AU' },
        { name: 'Japan', visitors: 432, percentage: 4.3, flag: 'JP' },
        { name: 'Brazil', visitors: 321, percentage: 3.2, flag: 'BR' },
      ],
    }
  },
})
