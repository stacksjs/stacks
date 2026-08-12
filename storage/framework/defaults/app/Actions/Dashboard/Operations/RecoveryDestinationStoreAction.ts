import type { BackupDestinationProvider } from '@stacksjs/ts-cloud'
import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'
import { dashboardOperationalError } from '../dashboard-response'
import { appendOperatorEvent } from './control-plane'
import { positiveNumber, stringValue } from './recovery-input'
import { recoveryEnvironment, recoveryRuntime, safeRecoveryDestination } from './recovery-runtime'

export default new Action({
  name: 'RecoveryDestinationStoreAction',
  description: 'Creates a native recovery destination with encrypted optional credentials.',
  method: 'POST',
  apiResponse: true,
  async handle(request: RequestInstance) {
    const input = request.all() as Record<string, unknown>
    const name = stringValue(input.name)
    const provider = stringValue(input.provider) as BackupDestinationProvider
    const bucket = stringValue(input.bucket)
    const encryption = stringValue(input.encryption) || 'provider'
    if (!name)
      return response.json({ message: 'A destination name is required.' }, 422)
    if (!['aws_s3', 's3_compatible', 'aws_backup'].includes(provider))
      return response.json({ message: 'Choose a supported destination provider.' }, 422)
    if (provider !== 'aws_backup' && !bucket)
      return response.json({ message: 'An object storage bucket is required.' }, 422)
    if (!['provider', 'client_side', 'both'].includes(encryption))
      return response.json({ message: 'Choose a supported encryption mode.' }, 422)

    const runtime = recoveryRuntime()
    const { controlPlane } = recoveryEnvironment()
    const secretRoot = `secret://data-services/backups/${controlPlane.project.id}/${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
    const credentials = input.credentials && typeof input.credentials === 'object'
      ? input.credentials as Record<string, unknown>
      : undefined
    const accessKeyId = stringValue(credentials?.accessKeyId)
    const secretAccessKey = stringValue(credentials?.secretAccessKey)
    const sessionToken = stringValue(credentials?.sessionToken)
    const encryptionKey = stringValue(input.encryptionKey)
    const storedSecrets: string[] = []
    if ((accessKeyId || secretAccessKey) && (!accessKeyId || !secretAccessKey))
      return response.json({ message: 'Both access key id and secret access key are required.' }, 422)
    if (encryption !== 'provider' && encryptionKey.length < 32)
      return response.json({ message: 'Client encryption requires a key of at least 32 characters.' }, 422)

    try {
      let credentialRef: string | undefined
      let encryptionKeyRef: string | undefined
      if (accessKeyId || secretAccessKey) {
        credentialRef = `${secretRoot}/credentials`
        await runtime.secrets.put(credentialRef, JSON.stringify({ accessKeyId, secretAccessKey, ...(sessionToken ? { sessionToken } : {}) }))
        storedSecrets.push(credentialRef)
      }
      if (encryption !== 'provider') {
        encryptionKeyRef = `${secretRoot}/encryption-key`
        await runtime.secrets.put(encryptionKeyRef, encryptionKey)
        storedSecrets.push(encryptionKeyRef)
      }

      const destination = runtime.store.createDestination({
        organizationId: controlPlane.organization.id,
        projectId: controlPlane.project.id,
        name,
        provider,
        endpoint: stringValue(input.endpoint) || undefined,
        endpointPolicy: input.allowPrivate === true ? 'allow_private' : 'public_https',
        bucket: bucket || undefined,
        prefix: stringValue(input.prefix),
        region: stringValue(input.region) || undefined,
        forcePathStyle: input.forcePathStyle === true,
        credentialRef,
        encryption: encryption as 'provider' | 'client_side' | 'both',
        encryptionKeyRef,
        immutability: {
          objectLock: Number(input.lockDays) > 0,
          defaultRetentionDays: Number(input.lockDays) > 0 ? positiveNumber(input.lockDays, 1, 36_500) : undefined,
        },
        status: 'untested',
      })
      await appendOperatorEvent(request, 'backup.destination_created', {
        destinationId: destination.id,
        provider: destination.provider,
      })
      return response.json({ success: true, destination: safeRecoveryDestination(destination) }, 201)
    }
    catch (error) {
      await Promise.all(storedSecrets.map(reference => runtime.secrets.remove(reference).catch(() => {})))
      return dashboardOperationalError(error, 'The recovery destination could not be created.', 'RecoveryDestinationStoreAction', 422)
    }
  },
})
