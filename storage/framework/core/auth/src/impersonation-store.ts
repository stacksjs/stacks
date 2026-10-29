import type { ImpersonationSession, ImpersonationStore } from './impersonation'
import { db, getDatabaseDialect, markContextWrote, sqlHelpers } from '@stacksjs/database/runtime'
import { config } from '@stacksjs/config'

interface Connection {
  unsafe(statement: string, parameters?: unknown[]): Promise<unknown>
}

/** Record a platform operation before releasing protected data. Errors propagate. */
export async function recordPrivilegedAccess(actorId: number, action: string, subjectId: number | null = null): Promise<void> {
  if (!Number.isSafeInteger(actorId) || actorId <= 0 || !/^[a-z][a-z0-9.:-]{1,63}$/.test(action)
    || (subjectId !== null && (!Number.isSafeInteger(subjectId) || subjectId <= 0)))
    throw new TypeError('Invalid privileged access audit.')
  const values = sqlHelpers(getDatabaseDialect()).params(crypto.randomUUID(), actorId, subjectId, action, Date.now(), '{}')
  await db.unsafe(`INSERT INTO auth_privileged_audits (id, actor_id, subject_id, event, occurred_at, details)
    VALUES (${values.sql})`, values.values).execute()
  markContextWrote()
}

function fromRow(row: Record<string, unknown>): ImpersonationSession {
  return {
    id: String(row.id), actorId: Number(row.actor_id), actorSessionId: String(row.actor_session_id),
    subjectId: Number(row.subject_id), reason: String(row.reason), expiresAt: Number(row.expires_at),
    endedAt: row.ended_at == null ? null : Number(row.ended_at),
  }
}

/** Explicit installation step, never invoked during an authentication request. */
export async function migrateImpersonationTables(): Promise<void> {
  await db.unsafe(`CREATE TABLE IF NOT EXISTS auth_impersonations (
    id VARCHAR(36) PRIMARY KEY, credential_hash VARCHAR(64) NOT NULL UNIQUE,
    actor_id BIGINT NOT NULL, actor_session_id VARCHAR(255) NOT NULL,
    subject_id BIGINT NOT NULL, reason VARCHAR(500) NOT NULL,
    expires_at BIGINT NOT NULL, ended_at BIGINT
  )`).execute()
  await db.unsafe(`CREATE TABLE IF NOT EXISTS auth_privileged_audits (
    id VARCHAR(36) PRIMARY KEY, session_id VARCHAR(36),
    actor_id BIGINT NOT NULL, subject_id BIGINT, event VARCHAR(64) NOT NULL,
    occurred_at BIGINT NOT NULL, details TEXT NOT NULL
  )`).execute()
}

/** Framework migration hook for applications opting into support viewing. */
export async function migrateEnabledImpersonationTables(): Promise<void> {
  if (config.auth.impersonation?.enabled) await migrateImpersonationTables()
}

/** Database transactions make session transitions and their audits inseparable. */
export function createDatabaseImpersonationStore(): ImpersonationStore {
  const sql = () => sqlHelpers(getDatabaseDialect())
  async function audit(tx: Connection, session: ImpersonationSession, event: string, now: number, details: unknown) {
    const values = sql().params(crypto.randomUUID(), session.id, session.actorId, session.subjectId, event, now, JSON.stringify(details))
    await tx.unsafe(`INSERT INTO auth_privileged_audits
      (id, session_id, actor_id, subject_id, event, occurred_at, details) VALUES (${values.sql})`, values.values)
  }
  async function locked(tx: Connection, id: string): Promise<ImpersonationSession | null> {
    const helpers = sql()
    const rows = await tx.unsafe(`SELECT id, actor_id, actor_session_id, subject_id, reason, expires_at, ended_at
      FROM auth_impersonations WHERE id = ${helpers.param(1)}${helpers.isPostgres || helpers.isMysql ? ' FOR UPDATE' : ''}`, [id]) as Record<string, unknown>[]
    return rows[0] ? fromRow(rows[0]) : null
  }
  return {
    async create(session, credentialHash) {
      await db.transaction(async raw => {
        const tx = raw as unknown as Connection
        const values = sql().params(session.id, credentialHash, session.actorId, session.actorSessionId,
          session.subjectId, session.reason, session.expiresAt)
        await tx.unsafe(`INSERT INTO auth_impersonations
          (id, credential_hash, actor_id, actor_session_id, subject_id, reason, expires_at)
          VALUES (${values.sql})`, values.values)
        await audit(tx, session, 'started', Date.now(), { reason: session.reason })
      })
      markContextWrote()
    },
    async find(hash) {
      const rows = await db.primary.unsafe(`SELECT id, actor_id, actor_session_id, subject_id, reason, expires_at, ended_at
        FROM auth_impersonations WHERE credential_hash = ${sql().param(1)}`, [hash]) as Record<string, unknown>[]
      return rows[0] ? fromRow(rows[0]) : null
    },
    async acceptAccess(id, access, now) {
      const accepted = await db.transaction(async raw => {
        const tx = raw as unknown as Connection
        const session = await locked(tx, id)
        const acceptedAt = Math.max(now, Date.now())
        if (!session || session.endedAt !== null || session.expiresAt <= acceptedAt) return false
        await audit(tx, session, 'accessed', acceptedAt, access)
        return true
      })
      if (accepted) markContextWrote()
      return accepted
    },
    async end(id, actorId, now) {
      await db.transaction(async raw => {
        const tx = raw as unknown as Connection
        const session = await locked(tx, id)
        if (!session || session.actorId !== actorId || session.endedAt !== null) return
        const values = sql().params(now, id)
        await tx.unsafe(`UPDATE auth_impersonations SET ended_at = ${sql().param(1)} WHERE id = ${sql().param(2)}`, values.values)
        await audit(tx, session, 'ended', now, {})
      })
      markContextWrote()
    },
  }
}
