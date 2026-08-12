import type { BackupResourceKind } from '@stacksjs/ts-cloud'
import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'
import { dashboardOperationalError } from '../dashboard-response'
import { appendOperatorEvent } from './control-plane'
import { positiveNumber, RECOVERY_KINDS, stringList, stringValue } from './recovery-input'
import { recoveryEnvironment, recoveryRuntime } from './recovery-runtime'

export default new Action({
  name: 'RecoveryPolicyStoreAction',
  description: 'Creates a scheduled native recovery policy for a configured source and destination.',
  method: 'POST',
  apiResponse: true,
  async handle(request: RequestInstance) {
    const input = request.all() as Record<string, unknown>
    const name = stringValue(input.name)
    const destinationId = stringValue(input.destinationId)
    const resourceKind = stringValue(input.resourceKind) as BackupResourceKind
    const includePatterns = stringList(input.includePatterns)
    const excludePatterns = stringList(input.excludePatterns)
    if (!name)
      return response.json({ message: 'A policy name is required.' }, 422)
    if (!RECOVERY_KINDS.includes(resourceKind))
      return response.json({ message: 'Choose a supported recovery source.' }, 422)

    const runtime = recoveryRuntime()
    const { controlPlane, environment } = recoveryEnvironment()
    const destination = runtime.store.getDestination(destinationId)
    if (!destination || destination.projectId !== controlPlane.project.id)
      return response.json({ message: 'Choose a valid recovery destination.' }, 422)
    if (destination.provider === 'aws_backup' && resourceKind !== 'infrastructure')
      return response.json({ message: 'AWS Backup destinations require an infrastructure recovery policy.' }, 422)

    const resourceId = stringValue(input.resourceId) || undefined
    const dataServiceId = stringValue(input.dataServiceId) || undefined
    if (['managed_database', 'logical_database'].includes(resourceKind)) {
      const service = dataServiceId ? runtime.dataServices.get(dataServiceId) : undefined
      if (!service || service.projectId !== controlPlane.project.id || service.environmentId !== environment.id)
        return response.json({ message: 'Database recovery policies require a data service in this environment.' }, 422)
    }
    if (['volume', 'files'].includes(resourceKind)) {
      const resource = resourceId ? controlPlane.store.getResource(resourceId) : undefined
      if (!resource || resource.projectId !== controlPlane.project.id || resource.environmentId !== environment.id)
        return response.json({ message: 'This recovery source requires a resource in the current environment.' }, 422)
    }
    if (resourceKind === 'volume' && includePatterns.length === 0)
      return response.json({ message: 'Volume policies require the Docker volume name.' }, 422)
    if (resourceKind === 'files' && includePatterns.length === 0)
      return response.json({ message: 'File policies require at least one project-relative include path.' }, 422)
    if (resourceKind === 'infrastructure' && (!includePatterns.some(value => value.startsWith('resource:arn:')) || !includePatterns.some(value => value.startsWith('role:arn:'))))
      return response.json({ message: 'Infrastructure policies require resource:arn: and role:arn: include entries.' }, 422)

    try {
      const policy = runtime.store.createPolicy({
        organizationId: controlPlane.organization.id,
        projectId: controlPlane.project.id,
        environmentId: environment.id,
        resourceId,
        dataServiceId,
        destinationId: destination.id,
        name,
        resourceKind,
        schedule: stringValue(input.schedule) || 'daily',
        timezone: stringValue(input.timezone) || 'UTC',
        retention: {
          keepLast: positiveNumber(input.keepLast, 7, 10_000),
          expireAfterDays: positiveNumber(input.expireAfterDays, 30, 36_500),
        },
        compression: ['none', 'gzip', 'zstd'].includes(stringValue(input.compression))
          ? stringValue(input.compression) as 'none' | 'gzip' | 'zstd'
          : 'gzip',
        encryption: 'destination',
        includePatterns,
        excludePatterns,
        expectedRpoMinutes: positiveNumber(input.expectedRpoMinutes, 1_440, 525_600),
        expectedRtoMinutes: positiveNumber(input.expectedRtoMinutes, 120, 525_600),
        enabled: input.enabled !== false,
      })
      await appendOperatorEvent(request, 'backup.policy_created', {
        policyId: policy.id,
        resourceKind: policy.resourceKind,
      }, policy.resourceId)
      return response.json({ success: true, policy }, 201)
    }
    catch (error) {
      return dashboardOperationalError(error, 'The recovery policy could not be created.', 'RecoveryPolicyStoreAction', 422)
    }
  },
})
