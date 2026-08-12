import type {
  BackupDestination,
  BackupPolicy,
  BackupSourceAdapter,
  JsonValue,
} from '@stacksjs/ts-cloud'
import { join } from 'node:path'
import process from 'node:process'
import {
  AwsDatabaseBackupSource,
  AwsInfrastructureBackupSource,
  BackupCoordinator,
  BackupStore,
  ControlPlaneBackupSource,
  createBackupQueueHandlers,
  DataServiceStore,
  DockerVolumeBackupSource,
  DurableOperationQueue,
  DurableQueueWorker,
  EncryptedDataSecretStore,
  FilesystemBackupSource,
  LogicalDatabaseBackupSource,
  resolveAuthEncryptionKey,
  S3BackupDestinationAdapter,
} from '@stacksjs/ts-cloud'
import { operationsControlPlane, operationsEnvironment } from './control-plane'

export interface RecoveryRuntime {
  store: BackupStore
  coordinator: BackupCoordinator
  queue: DurableOperationQueue
  worker: DurableQueueWorker
  dataServices: DataServiceStore
  secrets: EncryptedDataSecretStore
}

let runtime: RecoveryRuntime | undefined

export function recoveryRuntime(): RecoveryRuntime {
  if (runtime)
    return runtime

  const controlPlane = operationsControlPlane()
  const store = new BackupStore(controlPlane.store)
  const queue = new DurableOperationQueue(controlPlane.store, { workerId: `stacks-dashboard:${process.pid}` })
  const coordinator = new BackupCoordinator(store, queue)
  const dataServices = new DataServiceStore(controlPlane.store)
  const secrets = new EncryptedDataSecretStore(controlPlane.store, resolveAuthEncryptionKey(process.cwd()))
  const destination = new S3BackupDestinationAdapter(secrets)

  const resolveSource = (policy: BackupPolicy): BackupSourceAdapter | undefined => {
    if (policy.resourceKind === 'managed_database')
      return new AwsDatabaseBackupSource(dataServices)
    if (policy.resourceKind === 'logical_database')
      return new LogicalDatabaseBackupSource(dataServices, secrets)
    if (policy.resourceKind === 'volume')
      return new DockerVolumeBackupSource()
    if (policy.resourceKind === 'files')
      return new FilesystemBackupSource(process.cwd(), undefined, join(process.cwd(), 'storage', 'cloud', 'restores'))
    if (policy.resourceKind === 'control_plane')
      return new ControlPlaneBackupSource(controlPlane.store, process.cwd(), join(process.cwd(), 'storage', 'cloud', 'restores'))
    if (policy.resourceKind === 'infrastructure')
      return new AwsInfrastructureBackupSource()
    return undefined
  }

  const handlers = createBackupQueueHandlers({
    store,
    queue,
    resolveSource,
    resolveDestination: (value: BackupDestination) => value.provider === 'aws_backup' ? undefined : destination,
  })
  const worker = new DurableQueueWorker(queue, handlers, {
    parallelism: 2,
    pollIntervalMs: 2_000,
    onError: error => console.error('[dashboard/recovery] worker failed:', error),
  }).start()

  runtime = { store, coordinator, queue, worker, dataServices, secrets }
  return runtime
}

export function recoveryEnvironment() {
  const controlPlane = operationsControlPlane()
  const environment = operationsEnvironment(controlPlane)
  if (!environment)
    throw new Error('No cloud environment is configured for recovery operations.')
  return { controlPlane, environment }
}

export function safeRecoveryDestination(destination: BackupDestination): Record<string, JsonValue> {
  return {
    ...destination,
    credentialRef: null,
    encryptionKeyRef: null,
    credentialsConfigured: Boolean(destination.credentialRef),
    clientEncryptionConfigured: Boolean(destination.encryptionKeyRef),
  }
}
