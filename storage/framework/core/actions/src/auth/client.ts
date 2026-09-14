import process from 'node:process'
import { createClient } from '@stacksjs/auth'
import { ensureDatabaseConfigLoaded } from '@stacksjs/database'
import { log } from '@stacksjs/logging'

// Parse arguments from process.argv
const args = process.argv.slice(2)
const getArg = (name: string): string | undefined => {
  const idx = args.findIndex(a => a.startsWith(`--${name}=`) || a.startsWith(`-${name.charAt(0)}=`))
  if (idx !== -1) {
    const arg = args[idx]
    if (!arg) return undefined
    const eqIdx = arg.indexOf('=')
    return eqIdx >= 0 ? arg.slice(eqIdx + 1) : undefined
  }

  const flagIdx = args.findIndex(a => a === `--${name}` || a === `-${name.charAt(0)}`)
  const value = flagIdx !== -1 ? args[flagIdx + 1] : undefined
  if (value && !value.startsWith('-')) {
    return value
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

await ensureDatabaseConfigLoaded()
const { client, plainTextSecret } = await createClient({
  name,
  redirect,
  personalAccessClient: isPersonalAccess,
  passwordClient: isPasswordClient,
})

log.success('OAuth client created successfully')
log.info('')
log.info('Client Details:')
log.info(`  Client ID: ${client.id}`)
log.info('  Client Secret: [REDACTED]')
process.stdout.write(`Client Secret (save now, shown once): ${plainTextSecret}\n`)
log.info(`  Redirect URI: ${redirect}`)
log.info('')
log.warn('Make sure to save the client secret. You will not be able to retrieve it again.')

await log.flush()
process.exit(0)
