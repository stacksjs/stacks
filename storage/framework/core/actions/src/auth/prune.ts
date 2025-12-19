import process from 'node:process'
import { db, sql } from '@stacksjs/database'
import { log } from '@stacksjs/logging'

// Parse arguments from process.argv
const args = process.argv.slice(2)
const hasFlag = (name: string): boolean => {
  return args.includes(`--${name}`)
}
const getArg = (name: string): string | undefined => {
  const idx = args.findIndex(a => a.startsWith(`--${name}=`) || a.startsWith(`-${name.charAt(0)}=`))
  if (idx !== -1) return args[idx].split('=')[1]

  const flagIdx = args.findIndex(a => a === `--${name}` || a === `-${name.charAt(0)}`)
  if (flagIdx !== -1 && args[flagIdx + 1] && !args[flagIdx + 1].startsWith('-')) {
    return args[flagIdx + 1]
  }
  return undefined
}

const pruneExpired = !hasFlag('no-expired')
const pruneRevoked = !hasFlag('no-revoked')
const daysOld = Number(getArg('days')) || 7

log.info('Pruning authentication tokens...')

let expiredCount = 0
let revokedCount = 0

// Prune expired tokens
if (pruneExpired) {
  log.info('Removing expired tokens...')

  const expiredResult = await db.deleteFrom('personal_access_tokens')
    .where('expires_at', '<', sql.raw('NOW()'))
    .execute()

  expiredCount = Number(expiredResult.numDeletedRows || 0)
  log.success(`Removed ${expiredCount} expired token(s)`)
}

// Prune revoked tokens older than specified days
if (pruneRevoked) {
  log.info(`Removing tokens revoked more than ${daysOld} day(s) ago...`)

  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - daysOld)

  const revokedResult = await db.deleteFrom('personal_access_tokens')
    .where('revoked_at', 'is not', null)
    .where('revoked_at', '<', cutoffDate.toISOString())
    .execute()

  revokedCount = Number(revokedResult.numDeletedRows || 0)
  log.success(`Removed ${revokedCount} revoked token(s)`)
}

log.success(`Token pruning complete. Total removed: ${expiredCount + revokedCount}`)

process.exit(0)
