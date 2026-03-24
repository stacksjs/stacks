import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'ServerIndexAction',
  description: 'Returns server status data for the dashboard.',
  method: 'GET',
  async handle() {
    return {
      data: [
        { id: 'srv-1', name: 'Production', type: 'EC2 t3.medium', status: 'running', cpu: '34%', memory: '62%', disk: '45%', uptime: '30d 12h', ip: '10.0.1.100' },
        { id: 'srv-2', name: 'Staging', type: 'EC2 t3.small', status: 'running', cpu: '12%', memory: '38%', disk: '28%', uptime: '15d 6h', ip: '10.0.2.100' },
      ],
    }
  },
})
