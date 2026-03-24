import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'QueueStatsAction',
  description: 'Returns queue statistics.',
  method: 'GET',
  async handle() {
    return {
      data: [
        { name: 'default', size: 12, processing: 3, failed: 2, completed: 1543, delayed: 1 },
        { name: 'high', size: 5, processing: 2, failed: 0, completed: 876, delayed: 0 },
        { name: 'low', size: 23, processing: 1, failed: 4, completed: 2341, delayed: 3 },
      ],
    }
  },
})
