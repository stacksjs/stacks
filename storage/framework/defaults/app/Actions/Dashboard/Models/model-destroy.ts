/**
 * Deleting one record from the dashboard, and what happens when the database
 * will not let it go.
 *
 * A row other records still point at cannot be deleted: the foreign keys
 * refuse, and for most models that is the answer, said plainly. A user is
 * different. Nineteen tables point at `users`, so anyone who has signed in,
 * joined a team or placed an order could never be removed, and deleting
 * through all of those tables from one trash icon would destroy far more
 * than the operator can see.
 *
 * The app already says what removing a person means: each model's `gdpr`
 * trait declares whether their rows are deleted, anonymized or kept, and
 * `eraseSubject` applies it in one transaction with an audit row. So a user
 * who cannot be deleted is erased that way instead. By default that leaves
 * the account in place with its name, email and password removed and its
 * sign-ins revoked, and keeps the records that still refer to it.
 */
import { isForeignKeyViolation } from '@stacksjs/error-handling'
import { isErasureSubject } from './model-write'

export interface ErasureOutcome {
  /** What erasure did to the subject's own row. */
  action: 'anonymize' | 'delete' | 'keep'
}

export interface DestroyModelRecordDependencies {
  Model: any
  /** Apply the app's erasure rules to this user, recorded against `actor`. */
  erase: (id: number, actor: string) => Promise<ErasureOutcome>
  /** Who asked, for the erasure's audit row. */
  actor: string
}

// One member per reason, so checking `reason` narrows to the members that
// carry a `cause`.
export type DestroyModelRecordResult
  = | { ok: true, outcome: 'deleted' | 'anonymized' }
    | { ok: false, reason: 'missing' }
    | { ok: false, reason: 'referenced' }
    | { ok: false, reason: 'failed', cause: unknown }
    | { ok: false, reason: 'erasure-failed', cause: unknown }

export async function destroyModelRecord(id: number, dependencies: DestroyModelRecordDependencies): Promise<DestroyModelRecordResult> {
  const { Model } = dependencies
  try {
    const row = await Model.find(id)
    if (!row)
      return { ok: false, reason: 'missing' }
    await row.delete()
    return { ok: true, outcome: 'deleted' }
  }
  catch (error) {
    if (!isForeignKeyViolation(error))
      return { ok: false, reason: 'failed', cause: error }
    if (!isErasureSubject(Model))
      return { ok: false, reason: 'referenced' }
  }

  try {
    const { action } = await dependencies.erase(id, dependencies.actor)
    // The rules may say a user's own row is deleted, or kept as it is. Then
    // erasure has done what the app declared and the row is not anonymized;
    // only the default leaves an anonymized account behind.
    if (action === 'keep')
      return { ok: false, reason: 'referenced' }
    return { ok: true, outcome: action === 'delete' ? 'deleted' : 'anonymized' }
  }
  catch (error) {
    // Rules that delete the row meet the same foreign keys the delete did.
    if (isForeignKeyViolation(error))
      return { ok: false, reason: 'referenced' }
    return { ok: false, reason: 'erasure-failed', cause: error }
  }
}
