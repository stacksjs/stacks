import process from 'node:process'
import { createClient, registerOAuthClient, resolveOAuthProviderConfig } from '@stacksjs/auth'
import { config } from '@stacksjs/config'
import { ensureDatabaseConfigLoaded } from '@stacksjs/database'
import { log } from '@stacksjs/logging'
import { parseAuthClientArgs } from './client-options'

const options = parseAuthClientArgs(process.argv.slice(2))

log.info(`Creating OAuth client: ${options.name}`)

await ensureDatabaseConfigLoaded()
const result = options.provider
  ? await createProviderClient()
  : await createClient({
      name: options.name,
      redirect: options.redirects[0] || 'http://localhost',
      personalAccessClient: options.personal,
      passwordClient: options.password,
    })

async function createProviderClient() {
  if (options.personal || options.password)
    throw new Error('Provider clients cannot use --personal or --password.')
  if (!options.ownerId)
    throw new Error('Provider clients require a positive --owner user id.')
  if (!options.scopes.length)
    throw new Error('Provider clients require at least one --scopes value.')

  const provider = resolveOAuthProviderConfig(config.auth.oauthProvider)
  if (!provider)
    throw new Error('The OAuth authorization server is not enabled in config/auth.ts.')

  return registerOAuthClient(provider, options.ownerId, {
    name: options.name,
    type: options.type,
    tokenEndpointAuthMethod: options.type === 'public' ? 'none' : 'client_secret_basic',
    redirectUris: options.redirects,
    grantTypes: ['authorization_code', 'refresh_token'],
    scopes: options.scopes,
    resources: options.resources,
  })
}

const { client, plainTextSecret } = result

log.success('OAuth client created successfully')
log.info('')
log.info('Client Details:')
log.info(`  Client ID: ${client.id}`)
if (plainTextSecret)
  process.stdout.write(`Client Secret (save now, shown once): ${plainTextSecret}\n`)
else
  log.info('  Client Secret: none (public client)')
log.info(`  Redirect URI: ${options.redirects.join(', ')}`)
log.info('')
if (plainTextSecret)
  log.warn('Make sure to save the client secret. You will not be able to retrieve it again.')

await log.flush()
process.exit(0)
