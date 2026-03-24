import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'QueueWorkersAction',
  description: 'Returns queue worker information.',
  method: 'GET',
  async handle() {
    return {
      data: [
        { id: 'worker-1', name: 'worker-1', status: 'running', queues: ['default', 'high'], jobs_processed: 4521, uptime: '3d 12h', memory: '128MB' },
        { id: 'worker-2', name: 'worker-2', status: 'running', queues: ['default'], jobs_processed: 3876, uptime: '3d 12h', memory: '96MB' },
        { id: 'worker-3', name: 'worker-3', status: 'paused', queues: ['low'], jobs_processed: 2134, uptime: '1d 6h', memory: '64MB' },
      ],
    }
  },
})
