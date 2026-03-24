import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'DependencyIndexAction',
  description: 'Returns dependency data for the dashboard.',
  method: 'GET',
  async handle() {
    return {
      data: [
        { name: 'bun', version: '1.3.0', latest: '1.3.2', type: 'runtime', status: 'outdated' },
        { name: 'typescript', version: '5.7.0', latest: '5.7.0', type: 'devDependency', status: 'up-to-date' },
        { name: '@stacksjs/orm', version: '0.72.0', latest: '0.72.0', type: 'dependency', status: 'up-to-date' },
        { name: 'pickier', version: '1.2.0', latest: '1.3.0', type: 'devDependency', status: 'outdated' },
      ],
      outdated: 2,
      total: 45,
    }
  },
})
