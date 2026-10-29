import type { ImpersonationSession } from './impersonation'
import { config } from '@stacksjs/config'
import { getCurrentRequest } from '@stacksjs/router'
import { createImpersonationService, IMPERSONATION_HEADER } from './impersonation'
import { createDatabaseImpersonationStore } from './impersonation-store'
import { hasFreshRole } from './rbac'

const CONTEXT = Symbol.for('stacks.auth.impersonation')

export function requestImpersonation(): ImpersonationSession | null {
  const request = getCurrentRequest() as unknown as Record<symbol, unknown> | undefined
  return request?.[CONTEXT] as ImpersonationSession | undefined ?? null
}

/** The actor and session here have already passed ordinary token validation. */
export function authenticatedImpersonationService(actorId: number, actorSessionId: string) {
  return createImpersonationService(createDatabaseImpersonationStore(), {
    async currentActor() {
      const request = getCurrentRequest()
      if (!request || request.headers.has(IMPERSONATION_HEADER)) return null
      return { userId: actorId, sessionId: actorSessionId, impersonating: false }
    },
    async mayImpersonate(expectedActor, expectedSession, subjectId) {
      const policy = config.auth.impersonation
      return expectedActor === actorId && expectedSession === actorSessionId
        && policy?.enabled === true && typeof policy.eligible === 'function'
        && await hasFreshRole(actorId, 'super-admin', 'platform')
        && await policy.eligible(actorId) && await policy.eligible(subjectId)
    },
  })
}

export async function resolveRequestImpersonation(actorId: number, actorSessionId: string): Promise<ImpersonationSession | null> {
  const request = getCurrentRequest()
  if (!request) return null
  const credential = request.headers.get(IMPERSONATION_HEADER)
  if (!credential) return null
  const session = await authenticatedImpersonationService(actorId, actorSessionId).resolve(credential, {
    method: request.method, path: new URL(request.url).pathname,
  })
  if (session) (request as unknown as Record<symbol, unknown>)[CONTEXT] = session
  return session
}
