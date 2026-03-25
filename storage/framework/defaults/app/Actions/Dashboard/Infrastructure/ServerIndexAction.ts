import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'ServerIndexAction',
  description: 'Returns server status data for the dashboard.',
  method: 'GET',
  async handle() {
    const servers = [
      { name: 'web-1.stacks.dev', ip: '192.168.1.100', cpu: 45, memory: 62, disk: 34, status: 'healthy', uptime: '45d 12h' },
      { name: 'web-2.stacks.dev', ip: '192.168.1.101', cpu: 38, memory: 58, disk: 28, status: 'healthy', uptime: '45d 12h' },
      { name: 'db-primary.stacks.dev', ip: '192.168.1.200', cpu: 72, memory: 85, disk: 67, status: 'warning', uptime: '30d 8h' },
      { name: 'db-replica.stacks.dev', ip: '192.168.1.201', cpu: 25, memory: 45, disk: 67, status: 'healthy', uptime: '30d 8h' },
      { name: 'cache.stacks.dev', ip: '192.168.1.150', cpu: 12, memory: 78, disk: 15, status: 'healthy', uptime: '60d 4h' },
    ]

    const stats = [
      { label: 'Total Servers', value: '5' },
      { label: 'Healthy', value: '4' },
      { label: 'Warnings', value: '1' },
      { label: 'Avg CPU', value: '38%' },
    ]

    return {
      servers,
      stats,
    }
  },
})
