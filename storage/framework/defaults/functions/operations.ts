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
