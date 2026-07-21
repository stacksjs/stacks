export type CapabilityCategory = 'database' | 'queue' | 'cache' | 'storage' | 'mail' | 'realtime' | 'deploy'
export type CapabilityStatus = 'supported' | 'partial' | 'experimental' | 'unsupported'

export interface CapabilityDriver {
  category: CapabilityCategory
  name: string
  status: CapabilityStatus
  implementation: string | null
  testEvidence: string[]
  topology: string
  prerequisites: string[]
  limitations: string[]
}

export const capabilityRegistry: readonly CapabilityDriver[] = [
  { category: 'database', name: 'sqlite', status: 'supported', implementation: 'storage/framework/core/database/src/drivers/sqlite.ts', testEvidence: ['storage/framework/core/database/tests/integration.test.ts', 'storage/framework/core/database/tests/sqlite-tx-serialization.test.ts'], topology: 'embedded', prerequisites: ['Bun SQLite'], limitations: [] },
  { category: 'database', name: 'mysql', status: 'partial', implementation: 'storage/framework/core/database/src/drivers/mysql.ts', testEvidence: ['storage/framework/core/database/tests/integration.test.ts'], topology: 'client-server', prerequisites: ['MySQL service'], limitations: ['The default CI suite does not yet publish a dedicated dialect report.'] },
  { category: 'database', name: 'singlestore', status: 'experimental', implementation: 'storage/framework/core/database/src/drivers/mysql.ts', testEvidence: [], topology: 'client-server', prerequisites: ['SingleStore service'], limitations: ['MySQL wire compatibility exists, but a dedicated conformance matrix is not published.'] },
  { category: 'database', name: 'postgres', status: 'partial', implementation: 'storage/framework/core/database/src/drivers/postgres.ts', testEvidence: ['storage/framework/core/database/tests/postgres-pivot-timestamptz.test.ts'], topology: 'client-server', prerequisites: ['PostgreSQL service'], limitations: ['The default CI suite does not provision PostgreSQL.'] },
  { category: 'database', name: 'dynamodb', status: 'unsupported', implementation: 'storage/framework/core/database/src/drivers/dynamodb.ts', testEvidence: [], topology: 'managed-service', prerequisites: ['DynamoDB'], limitations: ['DynamoDB helpers are not an ORM SQL driver and cannot be selected as database.default.'] },
  { category: 'queue', name: 'sync', status: 'supported', implementation: 'storage/framework/core/queue/src/job.ts', testEvidence: ['storage/framework/core/queue/tests/jobs.test.ts'], topology: 'inline', prerequisites: [], limitations: ['Not durable.'] },
  { category: 'queue', name: 'database', status: 'supported', implementation: 'storage/framework/core/queue/src/job.ts', testEvidence: ['storage/framework/core/queue/tests/integration.test.ts', 'storage/framework/core/queue/tests/failure-path-correctness.test.ts'], topology: 'worker-and-database', prerequisites: ['Supported SQL database'], limitations: [] },
  { category: 'queue', name: 'redis', status: 'supported', implementation: 'storage/framework/core/queue/src/drivers/redis.ts', testEvidence: ['storage/framework/core/queue/tests/integration.test.ts', 'storage/framework/core/queue/tests/envelope.test.ts'], topology: 'worker-and-redis', prerequisites: ['Redis service'], limitations: [] },
  { category: 'queue', name: 'sqs', status: 'unsupported', implementation: null, testEvidence: [], topology: 'managed-service', prerequisites: ['AWS SQS'], limitations: ['Configuration shape is reserved; dispatch fails loudly.'] },
  { category: 'queue', name: 'memory', status: 'unsupported', implementation: null, testEvidence: [], topology: 'in-process', prerequisites: [], limitations: ['Reserved driver name; dispatch fails loudly.'] },
  { category: 'queue', name: 'beanstalkd', status: 'unsupported', implementation: null, testEvidence: [], topology: 'client-server', prerequisites: ['Beanstalkd service'], limitations: ['Reserved driver name; dispatch fails loudly.'] },
  { category: 'cache', name: 'memory', status: 'supported', implementation: 'storage/framework/core/cache/src/drivers/index.ts', testEvidence: ['storage/framework/core/cache/tests/Memory.test.ts', 'storage/framework/core/cache/tests/ttl.test.ts'], topology: 'in-process', prerequisites: [], limitations: ['Not shared across processes.'] },
  { category: 'cache', name: 'redis', status: 'supported', implementation: 'storage/framework/core/cache/src/drivers/index.ts', testEvidence: ['storage/framework/core/cache/tests/integration.test.ts'], topology: 'client-server', prerequisites: ['Redis service'], limitations: [] },
  { category: 'cache', name: 'singlestore', status: 'experimental', implementation: 'storage/framework/core/cache/src/drivers/singlestore.ts', testEvidence: [], topology: 'client-server', prerequisites: ['SingleStore service'], limitations: ['No dedicated CI service matrix.'] },
  { category: 'storage', name: 'local', status: 'supported', implementation: 'storage/framework/core/storage/src/adapters/local.ts', testEvidence: ['storage/framework/core/storage/tests/localStorage.test.ts', 'storage/framework/core/storage/tests/deep-integration.test.ts'], topology: 'local-filesystem', prerequisites: [], limitations: [] },
  { category: 'storage', name: 'memory', status: 'supported', implementation: 'storage/framework/core/storage/src/adapters/memory.ts', testEvidence: ['storage/framework/core/storage/tests/memoryAdapter.test.ts'], topology: 'in-process', prerequisites: [], limitations: ['Not persistent.'] },
  { category: 'storage', name: 's3', status: 'partial', implementation: 'storage/framework/core/storage/src/adapters/s3.ts', testEvidence: ['storage/framework/core/storage/tests/s3-presigned-post.test.ts'], topology: 'managed-object-storage', prerequisites: ['S3-compatible service and credentials'], limitations: ['CI covers request construction but not a live provider round trip.'] },
  { category: 'storage', name: 'bun', status: 'partial', implementation: 'storage/framework/core/storage/src/adapters/bun.ts', testEvidence: ['storage/framework/core/storage/tests/bunAdapter.test.ts'], topology: 'local-filesystem', prerequisites: ['Bun runtime'], limitations: ['Adapter-specific feature parity is not fully reported.'] },
  { category: 'mail', name: 'log', status: 'supported', implementation: 'storage/framework/core/email/src/drivers/log.ts', testEvidence: ['storage/framework/core/email/tests/email.test.ts'], topology: 'local-file', prerequisites: [], limitations: ['Development/testing transport only.'] },
  { category: 'mail', name: 'capture', status: 'supported', implementation: 'storage/framework/core/email/src/drivers/capture.ts', testEvidence: ['storage/framework/core/email/tests/email.test.ts'], topology: 'in-process', prerequisites: [], limitations: ['Testing transport only.'] },
  ...['smtp', 'ses', 'sendgrid', 'mailgun', 'mailtrap'].map((name): CapabilityDriver => ({ category: 'mail', name, status: 'partial', implementation: `storage/framework/core/email/src/drivers/${name}.ts`, testEvidence: ['storage/framework/core/email/tests/driver-credentials.test.ts'], topology: name === 'smtp' ? 'smtp-server' : 'managed-service', prerequisites: [`${name} credentials`], limitations: ['CI validates configuration and request behavior without a live delivery assertion.'] })),
  { category: 'realtime', name: 'websocket', status: 'supported', implementation: 'storage/framework/core/realtime/src/ws.ts', testEvidence: ['storage/framework/core/realtime/tests/ws-auth.test.ts', 'storage/framework/core/realtime/tests/backpressure.test.ts'], topology: 'single-process-websocket', prerequisites: ['Bun server'], limitations: ['Scale-out requires an application-provided fan-out layer.'] },
  { category: 'deploy', name: 'ts-cloud-hetzner', status: 'experimental', implementation: 'storage/framework/core/buddy/src/commands/deploy.ts', testEvidence: [], topology: 'hetzner-vm-systemd-rpx', prerequisites: ['@stacksjs/ts-cloud', 'Hetzner credentials', 'SSH key'], limitations: ['Live provider evidence and rollback conformance are not yet retained in the protocol report.'] },
] as const

export function capabilityDrivers(category: CapabilityCategory): readonly CapabilityDriver[] {
  return capabilityRegistry.filter(driver => driver.category === category)
}

export function findCapability(category: CapabilityCategory, name: string): CapabilityDriver | undefined {
  return capabilityRegistry.find(driver => driver.category === category && driver.name === name)
}

export function assertCapabilityAvailable(category: CapabilityCategory, name: string): CapabilityDriver {
  const capability = findCapability(category, name)
  if (!capability) {
    const known = capabilityDrivers(category).map(driver => driver.name).join(', ')
    throw new Error(`[config] Unknown ${category} driver "${name}". Known drivers: ${known}`)
  }
  if (capability.status === 'unsupported')
    throw new Error(`[config] ${category} driver "${name}" is unsupported: ${capability.limitations.join(' ')}`)
  return capability
}
