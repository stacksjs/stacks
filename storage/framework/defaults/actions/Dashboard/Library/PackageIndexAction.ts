import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'PackageIndexAction',
  description: 'Returns package data for the dashboard.',
  method: 'GET',
  async handle() {
    return {
      data: [
        { name: '@stacksjs/orm', version: '0.72.0', description: 'Stacks ORM with TypeScript magic', downloads: 12543, size: '245 KB' },
        { name: '@stacksjs/router', version: '0.72.0', description: 'Fast HTTP router for Bun', downloads: 11234, size: '189 KB' },
        { name: '@stacksjs/cache', version: '0.72.0', description: 'Caching with memory and Redis drivers', downloads: 9876, size: '98 KB' },
      ],
    }
  },
})
