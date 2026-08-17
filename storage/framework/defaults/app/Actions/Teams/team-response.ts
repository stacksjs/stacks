import type { ResponseStatus } from '@stacksjs/bun-router'
import { response } from '@stacksjs/router'

export class TeamStateConflictError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TeamStateConflictError'
  }
}

export function teamOperationalError(
  error: unknown,
  message: string,
  action: string,
  status: ResponseStatus = 503,
): Response {
  console.error(`[teams/api] ${action} failed:`, error)
  return response.json({ message }, status)
}

export function teamOperationalIssue(error: unknown, message: string, action: string): string {
  console.error(`[teams/api] ${action} failed:`, error)
  return message
}
