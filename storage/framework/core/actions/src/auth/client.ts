import process from 'node:process'
import { randomBytes } from 'node:crypto'
import { db } from '@stacksjs/database'
import { HttpError } from '@stacksjs/error-handling'
import { log } from '@stacksjs/logging'

// Parse arguments from process.argv
const args = process.argv.slice(2)
const getArg = (name: string): string | undefined => {
  const idx = args.findIndex(a => a.startsWith(`--${name}=`) || a.startsWith(`-${name.charAt(0)}=`))
  if (idx !== -1) return args[idx].split('=')[1]

  const flagIdx = args.findIndex(a => a === `--${name}` || a === `-${name.charAt(0)}`)
  if (flagIdx !== -1 && args[flagIdx + 1] && !args[flagIdx + 1].startsWith('-')) {
    return args[flagIdx + 1]
  }
  return undefined
}

const hasFlag = (name: string): boolean => {
  return args.includes(`--${name}`)
}

const name = getArg('name') || 'OAuth Client'
const redirect = getArg('redirect') || 'http://localhost'
const isPersonalAccess = hasFlag('personal')
const isPasswordClient = hasFlag('password')

log.info(`Creating OAuth client: ${name}`)

const secret = randomBytes(40).toString('hex')

const result = await db.insertInto('oauth_clients')
  .values({
    name,
    secret,
    provider: 'local',
    redirect,
    personal_access_client: isPersonalAccess,
    password_client: isPasswordClient,
    revoked: false,
  })
  .executeTakeFirst()

const insertId = result?.insertId || Number(result?.numInsertedOrUpdatedRows)

if (!insertId)
  throw new HttpError(500, 'Failed to create OAuth client')

log.success('OAuth client created successfully')
log.info('')
log.info('Client Details:')
log.info(`  Client ID: ${insertId}`)
log.info(`  Client Secret: ${secret}`)
log.info(`  Redirect URI: ${redirect}`)
log.info('')
log.warn('Make sure to save the client secret. You will not be able to retrieve it again.')

process.exit(0)
