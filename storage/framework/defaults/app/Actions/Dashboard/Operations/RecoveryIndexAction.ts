import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { dashboardOperationalError } from '../dashboard-response'
import { recoveryEnvironment, recoveryRuntime, safeRecoveryDestination } from './recovery-runtime'

export default new Action({
  name: 'RecoveryIndexAction',
  description: 'Returns recovery coverage, destinations, policies, points, jobs, and eligible resources.',
  method: 'GET',
  apiResponse: true,
  async handle(_request: RequestInstance) {
    try {
      const { controlPlane, environment } = recoveryEnvironment()
      const runtime = recoveryRuntime()
      const policies = runtime.store.listPolicies(controlPlane.project.id, environment.id)
      const policyIds = new Set(policies.map(policy => policy.id))
      const recoveryPoints = runtime.store
        .listRecoveryPoints(controlPlane.project.id)
        .filter(point => !point.policyId || policyIds.has(point.policyId))
      const jobs = runtime.store
        .listJobs(controlPlane.project.id)
        .filter(job => !job.policyId || policyIds.has(job.policyId))
      const coverage = runtime.store
        .coverage(controlPlane.project.id)
        .filter(item => policyIds.has(item.policy.id))
      const resources = controlPlane.store.listResources(controlPlane.project.id, environment.id)
      const dataServices = runtime.dataServices.list(controlPlane.project.id, environment.id).map(service => ({
        id: service.id,
        name: service.name,
        engine: service.engine,
        provider: service.provider,
        status: service.status,
      }))

      return {
        environment: { id: environment.id, name: environment.name, slug: environment.slug },
        coverage,
        destinations: runtime.store.listDestinations(controlPlane.project.id).map(safeRecoveryDestination),
        policies,
        recoveryPoints,
        jobs,
        resources: resources.map(resource => ({ id: resource.id, kind: resource.kind, name: resource.name, slug: resource.slug })),
        dataServices,
        summary: {
          policies: policies.length,
          protected: coverage.filter(item => !item.missedRpo && item.destinationHealthy).length,
          missedRpo: coverage.filter(item => item.missedRpo).length,
          unverified: recoveryPoints.filter(point => point.verificationState !== 'verified' && point.status === 'available').length,
          queuedJobs: jobs.filter(job => job.status === 'queued' || job.status === 'running').length,
          latestPoint: recoveryPoints.map(point => point.pointInTime).sort().at(-1) || null,
        },
      }
    }
    catch (error) {
      return dashboardOperationalError(error, 'Recovery operations could not be loaded.', 'RecoveryIndexAction')
    }
  },
})
