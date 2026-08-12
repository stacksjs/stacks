import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'
import { appendOperatorEvent, dashboardOperator } from './control-plane'
import { jsonObject, stringValue } from './recovery-input'
import { recoveryEnvironment, recoveryRuntime } from './recovery-runtime'

export default new Action({
  name: 'RecoveryRestoreAction',
  description: 'Validates or queues an isolated, in-place, or drill restore.',
  method: 'POST',
  apiResponse: true,
  async handle(request: RequestInstance) {
    const input = request.all() as Record<string, unknown>
    const runtime = recoveryRuntime()
    const { controlPlane } = recoveryEnvironment()
    const point = runtime.store.getRecoveryPoint(String(request.getParam('id') || ''))
    if (!point || point.projectId !== controlPlane.project.id)
      return response.json({ message: 'Recovery point not found.' }, 404)

    const mode = stringValue(input.mode) || 'isolated'
    const targetName = stringValue(input.targetName)
    const drill = input.drill === true
    const execute = input.execute === true
    if (!['isolated', 'in_place'].includes(mode))
      return response.json({ message: 'Restore mode must be isolated or in_place.' }, 422)
    if (!targetName)
      return response.json({ message: 'A restore target name is required.' }, 422)
    if (drill && mode === 'in_place')
      return response.json({ message: 'Recovery drills require an isolated target.' }, 422)

    const safetyBackupId = stringValue(input.safetyBackupId) || undefined
    if (safetyBackupId) {
      const safety = runtime.store.getRecoveryPoint(safetyBackupId)
      if (!safety || safety.projectId !== controlPlane.project.id)
        return response.json({ message: 'The safety recovery point was not found.' }, 422)
    }
    const target = point.kind === 'volume'
      ? { ...jsonObject(input.target), volumeName: targetName, inPlace: mode === 'in_place' }
      : point.kind === 'logical_database'
        ? { ...jsonObject(input.target), targetId: targetName, dataServiceId: targetName, inPlace: mode === 'in_place' }
        : { ...jsonObject(input.target), targetId: targetName, inPlace: mode === 'in_place' }
    const restoreInput = {
      mode: mode as 'isolated' | 'in_place',
      target,
      targetName,
      confirm: stringValue(input.confirm) || undefined,
      recentAuth: true,
      downtimeAcknowledged: input.downtimeAcknowledged === true,
      safetyBackupId,
    }

    try {
      const plan = runtime.coordinator.planRestore(point, restoreInput)
      if (!execute)
        return { success: true, plan, productionExecutionCreated: false }

      const actor = await dashboardOperator(request)
      const job = runtime.coordinator.enqueueRestore(point, { ...restoreInput, drill, actorId: actor.id })
      await appendOperatorEvent(request, drill ? 'backup.drill_queued' : 'backup.restore_queued', {
        recoveryPointId: point.id,
        backupJobId: job.id,
        mode: restoreInput.mode,
        target: targetName,
      }, point.resourceId)
      return response.json({ success: true, plan, job, productionExecutionCreated: true }, 202)
    }
    catch (error) {
      return response.json({ message: error instanceof Error ? error.message : String(error) }, 409)
    }
  },
})
