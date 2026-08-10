import { response } from '@stacksjs/router'

export function kanbanError(error: string, status: number): Response {
  return response.json({ error }, status)
}

export function kanbanActionError(error: unknown, action: string): Response {
  console.error(`[dashboard/kanban] ${action} failed:`, error)
  return kanbanError('The Kanban request could not be completed.', 500)
}
