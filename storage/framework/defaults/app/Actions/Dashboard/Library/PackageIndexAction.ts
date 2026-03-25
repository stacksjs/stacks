import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'PackageIndexAction',
  description: 'Returns package data for the dashboard.',
  method: 'GET',
  async handle() {
    const packages = [
      { name: '@stacksjs/core', version: '2.4.0', latest: '2.4.0', type: 'dependency', status: 'up-to-date' },
      { name: '@stacksjs/ui', version: '1.8.2', latest: '1.9.0', type: 'dependency', status: 'update-available' },
      { name: '@stacksjs/database', version: '3.1.0', latest: '3.1.0', type: 'dependency', status: 'up-to-date' },
      { name: 'typescript', version: '5.3.3', latest: '5.3.3', type: 'devDependency', status: 'up-to-date' },
      { name: 'bun', version: '1.0.21', latest: '1.0.25', type: 'devDependency', status: 'update-available' },
      { name: 'vitest', version: '1.1.0', latest: '1.2.0', type: 'devDependency', status: 'update-available' },
    ]

    const stats = [
      { label: 'Total Packages', value: '47' },
      { label: 'Up to Date', value: '41' },
      { label: 'Updates Available', value: '6' },
      { label: 'Security Issues', value: '0' },
    ]

    return { packages, stats }
  },
})
