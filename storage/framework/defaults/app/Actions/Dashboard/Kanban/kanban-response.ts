import { response } from '@stacksjs/router'

export function kanbanError(error: string, status: number): Response {
  return response.json({ error }, status)
}
