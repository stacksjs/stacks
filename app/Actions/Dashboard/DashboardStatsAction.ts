import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'Dashboard Stats',
  description: 'Fetch dashboard statistics for overview cards',
  method: 'GET',

  async handle() {
    // Mock data for development - replace with actual ORM queries when database is set up
    const stats = [
      {
        title: 'Total Users',
        value: '1,234',
        trend: 12,
        trendLabel: 'vs last period',
        icon: 'i-hugeicons-user-group',
        iconBg: 'primary',
      },
      {
        title: 'Active Orders',
        value: '567',
        trend: 8,
        trendLabel: 'vs last period',
        icon: 'i-hugeicons-shopping-cart-02',
        iconBg: 'success',
      },
      {
        title: 'Blog Posts',
        value: '89',
        trend: -3,
        trendLabel: 'vs last period',
        icon: 'i-hugeicons-document-validation',
        iconBg: 'info',
      },
      {
        title: 'Customers',
        value: '2,345',
        trend: 15,
        trendLabel: 'vs last period',
        icon: 'i-hugeicons-user-multiple',
        iconBg: 'warning',
      },
    ]

    // Return the stats directly - the router will handle JSON serialization
    return { stats }
  },
})
