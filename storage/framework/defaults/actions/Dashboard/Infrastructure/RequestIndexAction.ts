import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'RequestIndexAction',
  description: 'Returns request history data for the dashboard.',
  method: 'GET',
  async handle() {
    return {
      data: [
        { method: 'GET', path: '/api/users', status: 200, duration: '12ms', timestamp: new Date(Date.now() - 60000).toISOString() },
        { method: 'POST', path: '/api/orders', status: 201, duration: '45ms', timestamp: new Date(Date.now() - 120000).toISOString() },
        { method: 'GET', path: '/api/products', status: 200, duration: '8ms', timestamp: new Date(Date.now() - 180000).toISOString() },
        { method: 'DELETE', path: '/api/users/5', status: 204, duration: '15ms', timestamp: new Date(Date.now() - 240000).toISOString() },
        { method: 'GET', path: '/api/missing', status: 404, duration: '3ms', timestamp: new Date(Date.now() - 300000).toISOString() },
      ],
      stats: {
        totalRequests: 45231,
        avgResponseTime: '18ms',
        successRate: '98.7%',
        errorRate: '1.3%',
      },
    }
  },
})
