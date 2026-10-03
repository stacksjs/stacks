import type { AccountCredentials } from './account-types'

/**
 * Admin API credentials for the customer and order import, from env only.
 *
 * A credential passed as a command-line flag lands in shell history, in `ps`
 * output for every user on the machine, and in CI logs that echo commands.
 * There is deliberately no flag for any of these: the operator exports them,
 * or puts them in `.env`, which `buddy` loads.
 *
 * Every check here runs before the first request, so a missing credential
 * fails with the variable names and where to create them, never with a 401
 * halfway through an import.
 */

export const ACCOUNT_CREDENTIAL_ENV = {
  shopify: ['SHOPIFY_ADMIN_TOKEN'],
  woocommerce: ['WOOCOMMERCE_CONSUMER_KEY', 'WOOCOMMERCE_CONSUMER_SECRET'],
  shopware: ['SHOPWARE_CLIENT_ID', 'SHOPWARE_CLIENT_SECRET'],
} as const

/** Where each platform issues the credentials, for every message that asks for them. */
export const ACCOUNT_CREDENTIAL_HELP: Record<keyof typeof ACCOUNT_CREDENTIAL_ENV, string> = {
  shopify: 'Create a custom app for the store (Shopify admin > Settings > Apps > Develop apps, or the Shopify Dev Dashboard), give it the Admin API scopes read_customers and read_orders (plus read_all_orders for orders older than 60 days), install it, and copy its Admin API access token (shpat_...).',
  woocommerce: 'Create a key in WordPress admin > WooCommerce > Settings > Advanced > REST API > Add key, with Read permission, for a user who can manage WooCommerce. The key starts with ck_ and the secret with cs_.',
  shopware: 'Create an integration in the Shopware Administration > Settings > System > Integrations, with a role that can read customers and orders. Its access key id (SWIA...) is the client id and its secret access key is the client secret.',
}

export class MissingCredentialsError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MissingCredentialsError'
  }
}

type Env = Record<string, string | undefined>

function read(env: Env, name: string): string | undefined {
  const value = env[name]?.trim()
  return value ? value : undefined
}

/**
 * The credentials `source` needs, from `env`, or a `MissingCredentialsError`
 * naming every variable that is unset and where to create them. The values
 * themselves never appear in a message.
 */
export function readAccountCredentials(source: string, env: Env): AccountCredentials {
  const key = source.trim().toLowerCase() as keyof typeof ACCOUNT_CREDENTIAL_ENV
  const names = ACCOUNT_CREDENTIAL_ENV[key]
  if (!names)
    throw new MissingCredentialsError(`Customers and orders can be imported from ${Object.keys(ACCOUNT_CREDENTIAL_ENV).join(', ')}; got "${source}".`)

  const missing = names.filter(name => !read(env, name))
  if (missing.length > 0) {
    const what = missing.length === 1 ? `${missing[0]} is not set` : `${missing.join(' and ')} are not set`
    throw new MissingCredentialsError(`Importing customers or orders from ${key} needs Admin API credentials in the environment: ${what}. They are read from env (or .env) only, never from a flag, so they stay out of shell history. ${ACCOUNT_CREDENTIAL_HELP[key]}`)
  }

  const values = names.map(name => read(env, name)!)
  for (const [index, value] of values.entries()) {
    if (/\s/.test(value))
      throw new MissingCredentialsError(`${names[index]} contains whitespace; paste the credential exactly as issued. ${ACCOUNT_CREDENTIAL_HELP[key]}`)
  }

  if (key === 'shopify')
    return { source: 'shopify', accessToken: values[0]! }
  if (key === 'woocommerce')
    return { source: 'woocommerce', consumerKey: values[0]!, consumerSecret: values[1]! }

  // A sales channel key (SWSC) is the Store API's public key, not an integration.
  if (/^SWSC/i.test(values[0]!))
    throw new MissingCredentialsError(`SHOPWARE_CLIENT_ID looks like a sales channel access key (SWSC...), which only reads the public catalog. ${ACCOUNT_CREDENTIAL_HELP.shopware}`)
  return { source: 'shopware', clientId: values[0]!, clientSecret: values[1]! }
}

/** Every secret value in `credentials`, for scrubbing from messages. */
export function credentialSecrets(credentials: AccountCredentials): string[] {
  switch (credentials.source) {
    case 'shopify': return [credentials.accessToken]
    case 'woocommerce': return [credentials.consumerKey, credentials.consumerSecret]
    case 'shopware': return [credentials.clientId, credentials.clientSecret]
  }
}

/** `text` with every secret replaced, so an error never repeats a credential, even one a server echoed. */
export function redactSecrets(text: string, secrets: string[]): string {
  let result = text
  for (const secret of secrets) {
    if (secret.length >= 4)
      result = result.split(secret).join('[redacted]')
  }
  return result
}
