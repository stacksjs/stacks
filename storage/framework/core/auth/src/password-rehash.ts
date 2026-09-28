import { config } from '@stacksjs/config'
import { db, enqueueAfterCommit } from '@stacksjs/database/runtime'
import { log } from '@stacksjs/logging'
import { makeHash, needsRehash } from '@stacksjs/security'

const pendingRehashes = new Set<Promise<void>>()

function warnAboutRehash(userId: number, cause: unknown): void {
  const reason = cause instanceof Error ? cause.message : String(cause)
  try { void log.warn(`[auth] Password rehash failed for user#${userId}: ${reason}`) }
  catch {}
}

async function rehashPassword(userId: number, plaintext: string, verifiedHash: string): Promise<void> {
  const replacement = await makeHash(plaintext)

  // Match the exact credential that was verified. A password reset or another
  // successful rehash that lands first must never be overwritten by this task.
  await db.updateTable('users')
    .set({ password: replacement })
    .where('id', '=', userId)
    .where('password', '=', verifiedHash)
    .execute()
}

function queuePasswordRehash(userId: number, plaintext: string, verifiedHash: string): void {
  let task!: Promise<void>
  task = new Promise<void>(resolve => setTimeout(resolve, 0))
    .then(() => rehashPassword(userId, plaintext, verifiedHash))
    .catch(cause => warnAboutRehash(userId, cause))
    .finally(() => pendingRehashes.delete(task))
  pendingRehashes.add(task)
}

/**
 * Upgrade an outdated password hash after a successful credential issue.
 *
 * The work stays outside the response path and waits for an enclosing
 * transaction to commit. Any failure is reported but never changes the
 * already-successful login result.
 */
export function schedulePasswordRehash(userId: number, plaintext: string, verifiedHash: string): void {
  try {
    if (config.hashing?.rehashOnLogin === false || !needsRehash(verifiedHash))
      return

    const schedule = () => queuePasswordRehash(userId, plaintext, verifiedHash)
    if (!enqueueAfterCommit(schedule)) schedule()
  }
  catch (cause) {
    warnAboutRehash(userId, cause)
  }
}

/** Wait for background password upgrades in tests. */
export async function flushPasswordRehashes(): Promise<void> {
  while (pendingRehashes.size > 0)
    await Promise.allSettled([...pendingRehashes])
}
