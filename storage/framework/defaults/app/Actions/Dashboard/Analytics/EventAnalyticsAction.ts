import { Action } from '@stacksjs/actions'

// TODO: integrate with analytics provider (Fathom/Plausible)
export default new Action({
  name: 'EventAnalyticsAction',
  description: 'Returns goals and conversions data for the dashboard.',
  method: 'GET',
  async handle() {
    const goals = [
      { name: 'Newsletter Signups', target: 1000, current: 856, progress: 85.6, status: 'on_track' },
      { name: 'Product Demo Requests', target: 100, current: 112, progress: 112, status: 'completed' },
      { name: 'Free Trial Conversions', target: 50, current: 34, progress: 68, status: 'at_risk' },
      { name: 'Contact Form Submissions', target: 200, current: 189, progress: 94.5, status: 'on_track' },
      { name: 'Ebook Downloads', target: 500, current: 523, progress: 104.6, status: 'completed' },
    ]

    const stats = [
      { label: 'Active Goals', value: '5' },
      { label: 'Completed', value: '2' },
      { label: 'Avg Progress', value: '92.8%' },
      { label: 'At Risk', value: '1' },
    ]

    const conversions = [
      { funnel: 'Homepage \u2192 Signup', rate: '3.2%', visitors: '45,234', conversions: '1,447' },
      { funnel: 'Blog \u2192 Newsletter', rate: '8.5%', visitors: '12,345', conversions: '1,049' },
      { funnel: 'Pricing \u2192 Trial', rate: '12.3%', visitors: '5,432', conversions: '668' },
      { funnel: 'Trial \u2192 Paid', rate: '24.5%', visitors: '668', conversions: '164' },
    ]

    return {
      goals,
      stats,
      conversions,
    }
  },
})
