import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { operationsControlPlane, operationsEnvironment, recentOperatorOperations } from './control-plane'
import { alertStore } from './operations-runtime'

export default new Action({
  name: 'IncidentIndexAction',
  description: 'Returns native application alerts, rules, health checks, and notification delivery state.',
  method: 'GET',
  apiResponse: true,
  async handle(_request: RequestInstance) {
    const controlPlane = operationsControlPlane()
    const environment = operationsEnvironment(controlPlane)
    const store = alertStore()
    const alerts = store.listAlerts(controlPlane.project.id, { environmentId: environment?.id, limit: 200 })
    return {
      environment,
      alerts: alerts.map(alert => ({ ...alert, ownerName: alert.ownerActorId ? controlPlane.store.getActor(alert.ownerActorId)?.displayName : undefined })),
      rules: store.listRules(controlPlane.project.id, environment?.id),
      healthChecks: store.listHealthChecks(controlPlane.project.id, environment?.id),
      channels: store.listChannels(controlPlane.organization.id),
      deliveries: store.listDeliveries({ limit: 100 }),
      operations: recentOperatorOperations('dashboard.incidents.', 20),
      summary: {
        firing: alerts.filter(alert => alert.state === 'firing').length,
        critical: alerts.filter(alert => alert.state === 'firing' && alert.severity === 'critical').length,
        acknowledged: alerts.filter(alert => Boolean(alert.acknowledgedAt)).length,
        rules: store.listRules(controlPlane.project.id, environment?.id).filter(rule => rule.enabled).length,
      },
    }
  },
})
