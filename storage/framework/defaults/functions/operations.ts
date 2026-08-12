import { dashboardApi } from './dashboard-api'

export interface SchedulerTask {
  name: string
  pattern: string
  timezone: string
  nextRun: string | null
  enabled: boolean
}

export interface OperatorOperation {
  id: string
  actorName: string
  kind: string
  state: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled' | 'timed_out'
  input: Record<string, unknown>
  output: Record<string, unknown>
  error?: string
  startedAt?: string
  finishedAt?: string
  createdAt: string
}

export interface SchedulerOperationsResponse {
  tasks: SchedulerTask[]
  operations: OperatorOperation[]
  summary: {
    total: number
    active: number
    paused: number
    nextRun: string | null
  }
}

export interface SchedulerMutationResponse {
  success: boolean
  message: string
  task: string
  enabled?: boolean
  operation: OperatorOperation
}

export function fetchSchedulerOperations(): Promise<SchedulerOperationsResponse> {
  return dashboardApi<SchedulerOperationsResponse>('/api/dashboard/operations/scheduler')
}

export function runSchedulerTask(name: string): Promise<SchedulerMutationResponse> {
  return dashboardApi<SchedulerMutationResponse>(`/api/dashboard/operations/scheduler/${encodeURIComponent(name)}/run`, {
    method: 'POST',
  })
}

export function updateSchedulerTask(name: string, enabled: boolean): Promise<SchedulerMutationResponse> {
  return dashboardApi<SchedulerMutationResponse>(`/api/dashboard/operations/scheduler/${encodeURIComponent(name)}`, {
    method: 'PATCH',
    body: { enabled },
  })
}

export type BackupResourceKind = 'managed_database' | 'logical_database' | 'volume' | 'files' | 'control_plane' | 'infrastructure'

export interface RecoveryDestination {
  id: string
  name: string
  provider: 'aws_s3' | 's3_compatible' | 'aws_backup'
  bucket?: string
  region?: string
  status: 'untested' | 'healthy' | 'failing' | 'disabled'
  credentialsConfigured: boolean
  clientEncryptionConfigured: boolean
  lastTestedAt?: string
  lastError?: string
}

export interface RecoveryPolicy {
  id: string
  destinationId: string
  name: string
  resourceKind: BackupResourceKind
  schedule: string
  timezone: string
  expectedRpoMinutes: number
  expectedRtoMinutes: number
  enabled: boolean
  nextRunAt?: string
  lastRunAt?: string
}

export interface RecoveryPoint {
  id: string
  policyId?: string
  kind: BackupResourceKind
  pointInTime: string
  sizeBytes: number
  status: 'pending' | 'available' | 'failed' | 'deleting' | 'deleted'
  verificationState: 'unverified' | 'verifying' | 'verified' | 'corrupt' | 'failed'
  verifiedAt?: string
  held: boolean
  pinned: boolean
  expiresAt?: string
  lockedUntil?: string
}

export interface RecoveryJob {
  id: string
  policyId?: string
  recoveryPointId?: string
  operationId?: string
  kind: 'backup' | 'restore' | 'verify' | 'drill' | 'cleanup'
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled' | 'cleanup_required'
  progress: Record<string, unknown>
  error?: string
  startedAt?: string
  finishedAt?: string
  createdAt: string
}

export interface RecoveryCoverage {
  policy: RecoveryPolicy
  lastRecoveryPoint?: RecoveryPoint
  missedRpo: boolean
  unverified: number
  destinationHealthy: boolean
}

export interface RecoveryResource {
  id: string
  kind: string
  name: string
  slug: string
}

export interface RecoveryDataService {
  id: string
  name: string
  engine: string
  provider: string
  status: string
}

export interface RecoveryOperationsResponse {
  environment: { id: string, name: string, slug: string }
  coverage: RecoveryCoverage[]
  destinations: RecoveryDestination[]
  policies: RecoveryPolicy[]
  recoveryPoints: RecoveryPoint[]
  jobs: RecoveryJob[]
  resources: RecoveryResource[]
  dataServices: RecoveryDataService[]
  summary: {
    policies: number
    protected: number
    missedRpo: number
    unverified: number
    queuedJobs: number
    latestPoint: string | null
  }
}

export interface RecoveryDestinationInput {
  name: string
  provider: RecoveryDestination['provider']
  bucket?: string
  endpoint?: string
  prefix?: string
  region?: string
  allowPrivate?: boolean
  forcePathStyle?: boolean
  encryption: 'provider' | 'client_side' | 'both'
  encryptionKey?: string
  lockDays?: number
  credentials?: { accessKeyId?: string, secretAccessKey?: string, sessionToken?: string }
}

export interface RecoveryPolicyInput {
  name: string
  destinationId: string
  resourceKind: BackupResourceKind
  resourceId?: string
  dataServiceId?: string
  includePatterns: string[]
  excludePatterns: string[]
  schedule: string
  timezone: string
  keepLast: number
  expireAfterDays: number
  compression: 'none' | 'gzip' | 'zstd'
  expectedRpoMinutes: number
  expectedRtoMinutes: number
  enabled: boolean
}

export interface RestorePlanInput {
  mode: 'isolated' | 'in_place'
  targetName: string
  target?: Record<string, unknown>
  drill?: boolean
  execute?: boolean
  confirm?: string
  downtimeAcknowledged?: boolean
  safetyBackupId?: string
}

export function fetchRecoveryOperations(): Promise<RecoveryOperationsResponse> {
  return dashboardApi<RecoveryOperationsResponse>('/api/dashboard/operations/recovery')
}

export function createRecoveryDestination(input: RecoveryDestinationInput): Promise<{ success: boolean, destination: RecoveryDestination }> {
  return dashboardApi('/api/dashboard/operations/recovery/destinations', { method: 'POST', body: input })
}

export function testRecoveryDestination(id: string): Promise<{ success: boolean, message: string, destination: RecoveryDestination }> {
  return dashboardApi(`/api/dashboard/operations/recovery/destinations/${encodeURIComponent(id)}/test`, { method: 'POST' })
}

export function createRecoveryPolicy(input: RecoveryPolicyInput): Promise<{ success: boolean, policy: RecoveryPolicy }> {
  return dashboardApi('/api/dashboard/operations/recovery/policies', { method: 'POST', body: input })
}

export function runRecoveryPolicy(id: string): Promise<{ success: boolean, message: string, job: RecoveryJob }> {
  return dashboardApi(`/api/dashboard/operations/recovery/policies/${encodeURIComponent(id)}/run`, { method: 'POST' })
}

export function verifyRecoveryPoint(id: string): Promise<{ success: boolean, message: string, job: RecoveryJob }> {
  return dashboardApi(`/api/dashboard/operations/recovery/points/${encodeURIComponent(id)}/verify`, { method: 'POST' })
}

export function planRecoveryRestore(id: string, input: RestorePlanInput): Promise<{ success: boolean, plan: { mode: string, target: Record<string, unknown>, warnings: string[] }, productionExecutionCreated: boolean }> {
  return dashboardApi(`/api/dashboard/operations/recovery/points/${encodeURIComponent(id)}/restore`, { method: 'POST', body: input })
}

export function protectRecoveryPoint(id: string, input: { pinned?: boolean, held?: boolean }): Promise<{ success: boolean, recoveryPoint: RecoveryPoint }> {
  return dashboardApi(`/api/dashboard/operations/recovery/points/${encodeURIComponent(id)}/protection`, { method: 'PATCH', body: input })
}

export function runRecoveryRetention(): Promise<{ success: boolean, message: string, jobs: RecoveryJob[] }> {
  return dashboardApi('/api/dashboard/operations/recovery/retention', { method: 'POST' })
}

export interface MigrationPlanOperation {
  kind: string
  table: string
  column?: string
  sql?: string
  destructive: boolean
}

export interface MigrationLedgerEntry {
  file: string
  status: string
  recorded: boolean
  effects: Array<{ kind: string, table?: string, name: string }>
}

export interface MigrationOperationsResponse {
  environment: string
  dialect: string
  operations: MigrationPlanOperation[]
  revision: string
  applied: number
  ledger: {
    supported: boolean
    drift: boolean
    entries: MigrationLedgerEntry[]
    orphans: Array<{ migration: string, renamedTo?: string }>
    counts: Record<string, number>
  }
  reconciliation: Record<string, unknown>
  operatorOperations: OperatorOperation[]
  summary: { pending: number, destructive: number, drift: boolean, ledgerIssues: number }
}

export function fetchMigrationOperations(): Promise<MigrationOperationsResponse> {
  return dashboardApi('/api/dashboard/operations/migrations')
}

export function applyMigrationOperations(revision: string, confirmation: string): Promise<{ success: boolean, message: string, operation: OperatorOperation }> {
  return dashboardApi('/api/dashboard/operations/migrations/apply', { method: 'POST', body: { revision, confirmation } })
}

export function reconcileMigrationLedger(revision: string, confirmation: string): Promise<{ success: boolean, result: Record<string, unknown>, operation: OperatorOperation }> {
  return dashboardApi('/api/dashboard/operations/migrations/reconcile', { method: 'POST', body: { revision, confirmation } })
}

export interface ReleaseApprovalItem {
  id: string
  sourceSha?: string
  kind: string
  strategy: string
  createdAt: string
  approvals: Array<{ decision: string, comment?: string, createdAt: string }>
}

export interface ChangeOperationsResponse {
  environment?: { id: string, name: string, slug: string }
  migrations: MigrationOperationsResponse
  pendingReleases: ReleaseApprovalItem[]
  activeOperations: OperatorOperation[]
  recentOperations: OperatorOperation[]
  summary: { migrationChanges: number, destructiveChanges: number, approvals: number, activeOperations: number }
}

export function fetchChangeOperations(): Promise<ChangeOperationsResponse> {
  return dashboardApi('/api/dashboard/operations/changes')
}

export function decideRelease(id: string, decision: 'approved' | 'rejected', comment = ''): Promise<{ success: boolean }> {
  return dashboardApi(`/api/dashboard/operations/changes/releases/${encodeURIComponent(id)}/decision`, { method: 'POST', body: { decision, comment } })
}

export interface IncidentAlert {
  id: string
  state: string
  severity: string
  title: string
  occurrenceCount: number
  ownerName?: string
  acknowledgedAt?: string
  silencedUntil?: string
  firstSeenAt: string
  lastSeenAt: string
}

export interface IncidentOperationsResponse {
  alerts: IncidentAlert[]
  rules: Array<{ id: string, name: string, severity: string, enabled: boolean }>
  healthChecks: Array<{ id: string, name: string, kind: string, target: string, enabled: boolean }>
  channels: Array<{ id: string, name: string, kind: string, status: string }>
  deliveries: Array<Record<string, unknown>>
  operations: OperatorOperation[]
  summary: { firing: number, critical: number, acknowledged: number, rules: number }
}

export function fetchIncidentOperations(): Promise<IncidentOperationsResponse> {
  return dashboardApi('/api/dashboard/operations/incidents')
}

export function updateIncident(id: string, input: { action: 'acknowledge' | 'assign_self' | 'unassign' | 'silence', until?: string }): Promise<{ success: boolean, alert: IncidentAlert }> {
  return dashboardApi(`/api/dashboard/operations/incidents/${encodeURIComponent(id)}`, { method: 'PATCH', body: input })
}

export interface AuditEvent {
  id: string
  sequence: number
  operationId?: string
  actorName: string
  type: string
  level: string
  payload: unknown
  createdAt: string
}

export interface AuditOperationsResponse {
  events: AuditEvent[]
  operations: OperatorOperation[]
  summary: { events: number, operators: number, failures: number, latestSequence: number }
}

export function fetchAuditOperations(): Promise<AuditOperationsResponse> {
  return dashboardApi('/api/dashboard/operations/audit')
}
