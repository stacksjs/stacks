import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'QueryIndexAction',
  description: 'Returns recent database queries and stats for the dashboard.',
  method: 'GET',
  async handle() {
    return {
      queries: [
        { query: 'SELECT * FROM users WHERE...', time: '12ms', rows: 150, timestamp: '10:45:32' },
        { query: 'INSERT INTO orders VALUES...', time: '8ms', rows: 1, timestamp: '10:45:28' },
        { query: 'UPDATE posts SET status...', time: '15ms', rows: 5, timestamp: '10:45:25' },
        { query: 'SELECT * FROM products JOIN...', time: '234ms', rows: 1500, timestamp: '10:45:20' },
      ],
      stats: [
        { label: 'Total Queries', value: '45.2K' },
        { label: 'Avg Time', value: '8ms' },
        { label: 'Slow Queries', value: '12' },
      ],
    }
  },
})
