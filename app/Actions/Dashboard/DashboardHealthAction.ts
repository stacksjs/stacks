import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'Dashboard Health',
  description: 'Fetch system health status for dashboard',
  method: 'GET',

  async handle() {
    // Mock data for development - replace with actual service checks when fully configured
    const services = [
      {
        name: 'API',
        status: 'healthy',
        latency: '12ms',
        uptime: '99.9%',
      },
      {
        name: 'Database',
        status: 'healthy',
        latency: '8ms',
        uptime: '99.9%',
      },
      {
        name: 'Storage',
        status: 'healthy',
        latency: '5ms',
        uptime: '99.9%',
      },
      {
        name: 'Cache',
        status: 'healthy',
        latency: '2ms',
        uptime: '99.9%',
      },
      {
        name: 'Queue',
        status: 'healthy',
        latency: '5ms',
        uptime: '99.9%',
      },
      {
        name: 'Notifications',
        status: 'healthy',
        latency: '15ms',
        uptime: '99.8%',
      },
    ]

    // Return the services directly - the router will handle JSON serialization
    return { services }
  },
})
