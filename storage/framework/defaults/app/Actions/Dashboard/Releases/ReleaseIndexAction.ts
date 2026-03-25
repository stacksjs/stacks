import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'ReleaseIndexAction',
  description: 'Returns the list of releases with download stats.',
  method: 'GET',
  async handle() {
    return {
      data: [
        { version: '0.72.0', codename: 'Nebula', size: '2.4 MB', path: '/releases/0.72.0', createdAt: '2024-03-15T10:00:00Z' },
        { version: '0.71.0', codename: 'Aurora', size: '2.3 MB', path: '/releases/0.71.0', createdAt: '2024-03-01T10:00:00Z' },
        { version: '0.70.0', codename: 'Zenith', size: '2.2 MB', path: '/releases/0.70.0', createdAt: '2024-02-15T10:00:00Z' },
      ],
      stats: {
        labels: Array.from({ length: 30 }, (_, i) => new Date(Date.now() - (29 - i) * 86400000).toISOString().split('T')[0]),
        downloads: Array.from({ length: 30 }, () => Math.floor(Math.random() * 500) + 100),
        releaseTimes: Array.from({ length: 30 }, () => Math.floor(Math.random() * 30) + 5),
      },
    }
  },
})
