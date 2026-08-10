import { response } from '@stacksjs/router'

export function dashboardOperationalError(
  error: unknown,
  message: string,
  action: string,
  status = 503,
): Response {
  console.error(`[dashboard/api] ${action} failed:`, error)
  return response.json({ message }, status)
}

export function dashboardOperationalIssue(error: unknown, message: string, action: string): string {
  console.error(`[dashboard/api] ${action} failed:`, error)
  return message
}
