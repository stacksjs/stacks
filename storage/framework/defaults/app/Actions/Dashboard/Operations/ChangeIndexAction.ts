import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { operationsControlPlane, operationsEnvironment, recentOperatorOperations } from './control-plane'
import { migrationPlan } from './migration-operations'
import { releaseStore } from './operations-runtime'

export default new Action({
  name: 'ChangeIndexAction',
  description: 'Returns one review surface for pending schema, deployment, and release changes.',
  method: 'GET',
  apiResponse: true,
  async handle(_request: RequestInstance) {
    const controlPlane = operationsControlPlane()
    const environment = operationsEnvironment(controlPlane)
    const releases = releaseStore().list({ projectId: controlPlane.project.id, environmentId: environment?.id })
    const pendingReleases = releases.filter(release => release.status === 'awaiting_approval')
    const migrations = await migrationPlan()
    return {
      environment,
      migrations,
      pendingReleases: pendingReleases.map(release => ({ ...release, approvals: releaseStore().approvals(release.id) })),
      activeOperations: controlPlane.store.listOperations({ projectId: controlPlane.project.id, limit: 100 }).filter(operation => ['queued', 'running'].includes(operation.state)),
      recentOperations: recentOperatorOperations('dashboard.', 30),
      summary: {
        migrationChanges: migrations.summary.pending,
        destructiveChanges: migrations.summary.destructive,
        approvals: pendingReleases.length,
        activeOperations: controlPlane.store.listOperations({ projectId: controlPlane.project.id, limit: 100 }).filter(operation => ['queued', 'running'].includes(operation.state)).length,
      },
    }
  },
})
