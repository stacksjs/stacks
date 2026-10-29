import { createHash, randomBytes } from 'node:crypto'

export interface ImpersonationSession {
  id: string
  actorId: number
  actorSessionId: string
  subjectId: number
  reason: string
  expiresAt: number
  endedAt: number | null
}

export interface ImpersonationGrant {
  credential: string
  session: ImpersonationSession
}

export interface ImpersonationAccess {
  method: string
  /** Path only. Queries can contain credentials or personal data. */
  path: string
  workspaceId?: string
}

/**
 * Persistence must commit session changes and their audit events atomically.
 * acceptAccess must recheck endedAt and expiresAt in the same transaction as
 * its audit insert; a stale read must never resurrect a revoked session.
 */
export interface ImpersonationStore {
  create(session: ImpersonationSession, credentialHash: string): Promise<void>
  find(credentialHash: string): Promise<ImpersonationSession | null>
  acceptAccess(sessionId: string, access: ImpersonationAccess, now: number): Promise<boolean>
  end(sessionId: string, actorId: number, now: number): Promise<void>
}

export interface ImpersonationAuthority {
  /** Reauthenticate the current actor and reject already impersonated sessions. */
  currentActor(): Promise<{ userId: number, sessionId: string, impersonating: boolean } | null>
  /** Read current grant, actor session revocation and account eligibility. */
  mayImpersonate(actorId: number, actorSessionId: string, subjectId: number): Promise<boolean>
  /** Resolve the viewed account's actual workspace, after authorization. */
  workspaceId?: (subjectId: number) => string | number | null | Promise<string | number | null>
}

export const IMPERSONATION_HEADER = 'x-stacks-impersonation'
const PREFIX = 'stacks_imp_'
const CREDENTIAL = /^stacks_imp_[a-f0-9]{80}$/

function credentialHash(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function validId(id: number): boolean {
  return Number.isSafeInteger(id) && id > 0
}

/**
 * Lifecycle for separately revocable support-view credentials. This service
 * never issues a subject's ordinary login token and never returns the actor's
 * original credential. The host must resolve it at its authentication boundary.
 */
export function createImpersonationService(store: ImpersonationStore, authority: ImpersonationAuthority) {
  return {
    async start(subjectId: number, reason: string): Promise<ImpersonationGrant> {
      const actor = await authority.currentActor()
      if (!actor || actor.impersonating || !validId(actor.userId) || !actor.sessionId
        || !validId(subjectId) || actor.userId === subjectId)
        throw new Error('Impersonation is not authorized.')
      const normalizedReason = reason.trim()
      if (normalizedReason.length < 10 || normalizedReason.length > 500)
        throw new TypeError('Provide a reason between 10 and 500 characters.')
      if (!await authority.mayImpersonate(actor.userId, actor.sessionId, subjectId))
        throw new Error('Impersonation is not authorized.')
      const credential = `${PREFIX}${randomBytes(40).toString('hex')}`
      const session: ImpersonationSession = {
        id: crypto.randomUUID(), actorId: actor.userId, actorSessionId: actor.sessionId,
        subjectId, reason: normalizedReason, expiresAt: Date.now() + 15 * 60_000, endedAt: null,
      }
      await store.create(session, credentialHash(credential))
      return { credential, session }
    },

    async resolve(credential: string, access: ImpersonationAccess): Promise<ImpersonationSession | null> {
      if (!CREDENTIAL.test(credential)) return null
      // Support viewing cannot enroll credentials, change a password, mint an
      // API key, or mutate the viewed account. Writes require the real actor.
      // Multiplexed application actions can distinguish GET from every other
      // verb. HEAD must not fall into their write branch during support viewing.
      if (access.method !== 'GET' || !/^\/(?!\/)[^?#\r\n]*$/.test(access.path)) return null
      const session = await store.find(credentialHash(credential))
      if (!session || !validId(session.actorId) || !validId(session.subjectId)
        || session.actorId === session.subjectId || session.endedAt !== null
        || !Number.isFinite(session.expiresAt) || session.expiresAt <= Date.now()) return null
      if (!await authority.mayImpersonate(session.actorId, session.actorSessionId, session.subjectId)) return null
      // Audit failures propagate. A missing audit record cannot grant access.
      const workspace = await authority.workspaceId?.(session.subjectId)
      const workspaceId = workspace == null ? undefined : String(workspace)
      if (workspaceId !== undefined && !/^[A-Za-z0-9._:-]{1,128}$/.test(workspaceId))
        throw new TypeError('Invalid support-view workspace identifier.')
      if (!await store.acceptAccess(session.id, { method: access.method, path: access.path, ...(workspaceId === undefined ? {} : { workspaceId }) }, Date.now())) return null
      return session
    },

    async end(credential: string): Promise<void> {
      if (!CREDENTIAL.test(credential)) return
      const actor = await authority.currentActor()
      if (!actor || actor.impersonating) throw new Error('Impersonation is not authorized.')
      const session = await store.find(credentialHash(credential))
      if (!session || session.actorId !== actor.userId || session.actorSessionId !== actor.sessionId)
        throw new Error('Impersonation is not authorized.')
      await store.end(session.id, actor.userId, Date.now())
    },
  }
}
