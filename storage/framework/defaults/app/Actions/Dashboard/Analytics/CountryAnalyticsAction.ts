import { Action } from '@stacksjs/actions'

// TODO: integrate with analytics provider (Fathom/Plausible)
export default new Action({
  name: 'CountryAnalyticsAction',
  description: 'Returns country analytics data for the dashboard.',
  method: 'GET',
  async handle() {
    return {
      countries: [
        { name: 'United States', visitors: 4521, percentage: 45.2, flag: '🇺🇸' },
        { name: 'United Kingdom', visitors: 1234, percentage: 12.3, flag: '🇬🇧' },
        { name: 'Germany', visitors: 987, percentage: 9.9, flag: '🇩🇪' },
        { name: 'Canada', visitors: 876, percentage: 8.8, flag: '🇨🇦' },
        { name: 'France', visitors: 654, percentage: 6.5, flag: '🇫🇷' },
        { name: 'Australia', visitors: 543, percentage: 5.4, flag: '🇦🇺' },
        { name: 'Japan', visitors: 432, percentage: 4.3, flag: '🇯🇵' },
        { name: 'Brazil', visitors: 321, percentage: 3.2, flag: '🇧🇷' },
      ],
    }
  },
})
