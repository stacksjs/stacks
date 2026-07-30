import { Action } from '@stacksjs/actions'
import { workspacePackageRows } from './library-source'

export default new Action({
  name: 'PackageIndexAction',
  description: 'Returns package data for the dashboard.',
  method: 'GET',
  async handle() {
    const packages = workspacePackageRows()

    return {
      packages,
      publicCount: packages.filter(pkg => !pkg.private).length,
      privateCount: packages.filter(pkg => pkg.private).length,
      dependencyCount: packages.reduce((sum, pkg) => sum + pkg.dependencyCount, 0),
      source: 'bun.lock',
    }
  },
})
