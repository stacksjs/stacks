import { dashboardApi } from './dashboard-api'

export interface DeploymentRecord {
  id: string
  commitHash: string
  commitMessage: string
  branch: string
  status: string
  environment: string
  duration: number | null
  author: string
  url: string
  errorLog: string
  createdAt: string
  updatedAt: string
}

export interface DeploymentSummary {
  total: number
  successful: number
  failed: number
  active: number
  averageDuration: number | null
}

export interface DeployScript {
  path: string
  content: string
  exists: boolean
}

export interface DeploymentTerminal {
  path: string
  output: string
  exists: boolean
}

export interface DeployScriptUpdate {
  success: boolean
  path: string
}

type DeploymentPayload = Record<string, unknown>

function textValue(record: DeploymentPayload, camel: string, snake: string): string {
  const value = record[camel] ?? record[snake]
  return value == null ? '' : String(value)
}

export function normalizeDeployment(record: DeploymentPayload): DeploymentRecord {
  const durationValue = record.duration
  const duration = durationValue == null || durationValue === ''
    ? null
    : Number(durationValue)

  return {
    id: String(record.id ?? record.uuid ?? ''),
    commitHash: textValue(record, 'commitHash', 'commit_hash'),
    commitMessage: textValue(record, 'commitMessage', 'commit_message'),
    branch: textValue(record, 'branch', 'branch'),
    status: textValue(record, 'status', 'status').toLowerCase(),
    environment: textValue(record, 'environment', 'environment'),
    duration: Number.isFinite(duration) ? duration : null,
    author: textValue(record, 'author', 'author'),
    url: textValue(record, 'url', 'url'),
    errorLog: textValue(record, 'errorLog', 'error_log'),
    createdAt: textValue(record, 'createdAt', 'created_at'),
    updatedAt: textValue(record, 'updatedAt', 'updated_at'),
  }
}

export function normalizeDeploymentList(payload: unknown): DeploymentRecord[] {
  if (!payload || typeof payload !== 'object')
    return []

  const body = payload as { data?: unknown; deployments?: unknown }
  const records = Array.isArray(body.data)
    ? body.data
    : Array.isArray(body.deployments)
      ? body.deployments
      : []

  return records
    .filter((record): record is DeploymentPayload => Boolean(record && typeof record === 'object'))
    .map(normalizeDeployment)
}

export function normalizeDeploymentDetail(payload: unknown): DeploymentRecord | null {
  if (!payload || typeof payload !== 'object')
    return null

  const body = payload as { data?: unknown; deployment?: unknown }
  const record = body.deployment && typeof body.deployment === 'object'
    ? body.deployment
    : body.data && typeof body.data === 'object'
      ? body.data
      : null

  return record ? normalizeDeployment(record as DeploymentPayload) : null
}

export function summarizeDeployments(deployments: DeploymentRecord[]): DeploymentSummary {
  const successfulStatuses = new Set(['success', 'successful', 'completed', 'ready'])
  const failedStatuses = new Set(['failed', 'error', 'cancelled'])
  const activeStatuses = new Set(['pending', 'queued', 'running', 'deploying'])
  const durations = deployments
    .map(deployment => deployment.duration)
    .filter((duration): duration is number => duration !== null && duration >= 0)

  return {
    total: deployments.length,
    successful: deployments.filter(deployment => successfulStatuses.has(deployment.status)).length,
    failed: deployments.filter(deployment => failedStatuses.has(deployment.status)).length,
    active: deployments.filter(deployment => activeStatuses.has(deployment.status)).length,
    averageDuration: durations.length > 0
      ? durations.reduce((sum, duration) => sum + duration, 0) / durations.length
      : null,
  }
}

export async function fetchDeployments(): Promise<DeploymentRecord[]> {
  const payload = await dashboardApi<unknown>('/api/dashboard/deployments')
  return normalizeDeploymentList(payload)
}

export async function fetchDeployment(id: string): Promise<DeploymentRecord | null> {
  const payload = await dashboardApi<unknown>(`/api/dashboard/deployments/${encodeURIComponent(id)}`)
  return normalizeDeploymentDetail(payload)
}

export async function fetchDeployScript(): Promise<DeployScript> {
  return dashboardApi<DeployScript>('/api/dashboard/deployments/script')
}

export async function updateDeployScript(content: string): Promise<DeployScriptUpdate> {
  return dashboardApi<DeployScriptUpdate>('/api/dashboard/deployments/script', {
    method: 'PUT',
    body: { content },
  })
}

export async function fetchDeploymentTerminal(): Promise<DeploymentTerminal> {
  return dashboardApi<DeploymentTerminal>('/api/dashboard/deployments/terminal')
}
