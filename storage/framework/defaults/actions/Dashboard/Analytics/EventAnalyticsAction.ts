import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'EventAnalyticsAction',
  description: 'Returns event analytics data for the dashboard.',
  method: 'GET',
  async handle() {
    return {
      events: [
        { name: 'page_view', count: 45231, trend: 12.5 },
        { name: 'button_click', count: 12876, trend: 5.3 },
        { name: 'form_submit', count: 3456, trend: -2.1 },
        { name: 'signup', count: 876, trend: 18.7 },
        { name: 'purchase', count: 234, trend: 8.9 },
      ],
      totalEvents: 62673,
    }
  },
})
