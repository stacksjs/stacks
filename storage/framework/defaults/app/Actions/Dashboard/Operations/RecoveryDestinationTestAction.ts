import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'
import { S3BackupDestinationAdapter } from '@stacksjs/ts-cloud'
import { appendOperatorEvent } from './control-plane'
import { recoveryRuntime, safeRecoveryDestination } from './recovery-runtime'

export default new Action({
  name: 'RecoveryDestinationTestAction',
  description: 'Tests recovery destination write, read, checksum, and cleanup behavior.',
  method: 'POST',
  apiResponse: true,
  async handle(request: RequestInstance) {
    const runtime = recoveryRuntime()
    const destination = runtime.store.getDestination(String(request.getParam('id') || ''))
    if (!destination)
      return response.json({ message: 'Recovery destination not found.' }, 404)
    if (destination.provider === 'aws_backup')
      return response.json({ message: 'AWS Backup destinations are verified by creating a provider recovery point.' }, 409)

    try {
      await new S3BackupDestinationAdapter(runtime.secrets).test(destination)
      const tested = runtime.store.recordDestinationTest(destination.id, { ok: true })
      await appendOperatorEvent(request, 'backup.destination_tested', { destinationId: destination.id, ok: true })
      return { success: true, destination: safeRecoveryDestination(tested), message: `${destination.name} passed write, read, checksum, and cleanup checks.` }
    }
    catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      runtime.store.recordDestinationTest(destination.id, { ok: false, error: message })
      await appendOperatorEvent(request, 'backup.destination_tested', { destinationId: destination.id, ok: false })
      return response.json({ message }, 502)
    }
  },
})
