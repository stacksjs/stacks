import { RbacEntityNotFoundError } from '@stacksjs/auth'
import { response } from '@stacksjs/router'

export function rbacActionError(error: unknown, fallback: string, action: string): Response {
  if (error instanceof RbacEntityNotFoundError)
    return response.json({ error: error.message }, 400)

  console.error(`[dashboard/rbac] ${action} failed:`, error)
  return response.json({ error: fallback }, 500)
}
