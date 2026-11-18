import { environmentLayerIssues, readEnvironmentLayers, updateEnvironmentLayers } from '../Infrastructure/environment-layers'
import type { EnvironmentLayersOptions } from '../Infrastructure/environment-layers'

export const MAIL_DRIVERS = [
  'log',
  'smtp',
  'ses',
  'sendgrid',
  'mailgun',
  'mailtrap',
  'capture',
] as const

export type MailDriver = typeof MAIL_DRIVERS[number]

export interface MailSettingsState {
  revision: string
  /**
   * The env files the shown values come from, in the order the app loads
   * them; `.env` when none sets any. A save writes each value back to the
   * file it came from (stacksjs/stacks#3340).
   */
  sources: string[]
  /**
   * Mail keys a later env file sets with ciphertext this server cannot
   * decrypt. The app skips those entries here, so the values shown are the
   * ones in use; wherever that file's key is present, its values apply
   * instead of what is saved.
   */
  overridden: Array<{ key: string, file: string }>
  driver: MailDriver
  fromName: string
  fromAddress: string
  smtp: {
    host: string
    port: number
    username: string
    encryption: '' | 'tls' | 'ssl'
    passwordConfigured: boolean
  }
  ses: {
    region: string
    accessKeyId: string
    secretAccessKeyConfigured: boolean
  }
  sendgrid: {
    apiKeyConfigured: boolean
  }
  mailgun: {
    domain: string
    endpoint: string
    apiKeyConfigured: boolean
  }
  mailtrap: {
    host: string
    inboxId: string
    tokenConfigured: boolean
  }
}

/**
 * Whatever the settings form posted.
 *
 * Every field is optional AND `unknown`: this is the raw request body, and
 * `updateMailSettings` runs each value through `stringValue` and validates it.
 * Declaring the four core fields as required meant `request.all()` - the only
 * thing any caller has - did not satisfy the type it was written for.
 */
export interface MailSettingsInput {
  revision?: unknown
  driver?: unknown
  fromName?: unknown
  fromAddress?: unknown
  smtp?: Record<string, unknown>
  ses?: Record<string, unknown>
  sendgrid?: Record<string, unknown>
  mailgun?: Record<string, unknown>
  mailtrap?: Record<string, unknown>
}

export interface MailSettingsValidation {
  fields: Record<string, string>
}

export type MailSettingsUpdateResult =
  | { state: MailSettingsState }
  | { validation: MailSettingsValidation }
  | { conflict: true }

const SECRET_KEYS = [
  'MAIL_PASSWORD',
  'AWS_SECRET_ACCESS_KEY',
  'SENDGRID_API_KEY',
  'MAILGUN_API_KEY',
  'MAILTRAP_TOKEN',
] as const

/** The form field each written key is entered in, so a refusal about it shows there. */
const KEY_FIELDS: Record<string, string> = {
  MAIL_MAILER: 'driver',
  MAIL_FROM_NAME: 'fromName',
  MAIL_FROM_ADDRESS: 'fromAddress',
  MAIL_HOST: 'smtp.host',
  MAIL_PORT: 'smtp.port',
  MAIL_USERNAME: 'smtp.username',
  MAIL_ENCRYPTION: 'smtp.encryption',
  AWS_SES_REGION: 'ses.region',
  AWS_ACCESS_KEY_ID: 'ses.accessKeyId',
  MAILGUN_DOMAIN: 'mailgun.domain',
  MAILGUN_ENDPOINT: 'mailgun.endpoint',
  MAILTRAP_HOST: 'mailtrap.host',
  MAILTRAP_INBOX_ID: 'mailtrap.inboxId',
  MAIL_PASSWORD: 'smtp.password',
  AWS_SECRET_ACCESS_KEY: 'ses.secretAccessKey',
  SENDGRID_API_KEY: 'sendgrid.apiKey',
  MAILGUN_API_KEY: 'mailgun.apiKey',
  MAILTRAP_TOKEN: 'mailtrap.token',
}

/** Every env key the page reads. */
const MAIL_KEYS = [
  'APP_NAME',
  'MAIL_MAILER',
  'MAIL_DRIVER',
  'MAIL_FROM_NAME',
  'MAIL_FROM_ADDRESS',
  'MAIL_HOST',
  'MAIL_PORT',
  'MAIL_USERNAME',
  'MAIL_ENCRYPTION',
  'AWS_SES_REGION',
  'AWS_DEFAULT_REGION',
  'AWS_ACCESS_KEY_ID',
  'MAILGUN_DOMAIN',
  'MAILGUN_ENDPOINT',
  'MAILTRAP_HOST',
  'MAILTRAP_INBOX_ID',
  ...SECRET_KEYS,
] as const

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function rawString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function configured(value: string | undefined): boolean {
  return Boolean(value && value !== 'null')
}

function normalizedDriver(value: string | undefined): MailDriver {
  if (value === undefined)
    return 'log'
  if (!MAIL_DRIVERS.includes(value as MailDriver))
    throw new TypeError(`MAIL_MAILER must be one of: ${MAIL_DRIVERS.join(', ')}.`)
  return value as MailDriver
}

function normalizedEncryption(value: string | undefined): '' | 'tls' | 'ssl' {
  if (value === undefined || value === '' || value === 'null')
    return ''
  if (value !== 'tls' && value !== 'ssl')
    throw new TypeError('MAIL_ENCRYPTION must be empty, tls, or ssl.')
  return value
}

function portValue(value: string | undefined): number {
  if (value === undefined)
    return 2525
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535)
    throw new TypeError('MAIL_PORT must be an integer from 1 to 65535.')
  return parsed
}

export async function readMailSettings(options: EnvironmentLayersOptions = {}): Promise<MailSettingsState> {
  const layers = await readEnvironmentLayers(options)
  const environmentIssues = environmentLayerIssues(layers)
  if (environmentIssues.length) {
    const issue = environmentIssues[0]!
    const location = issue.line > 0 ? ` on line ${issue.line} of ${issue.file}` : ` (${issue.file})`
    throw new TypeError(`The environment file is invalid${location}: ${issue.message}`)
  }
  const { entries } = layers
  const read = MAIL_KEYS.filter(key => layers.sources[key])
  const sources = layers.layers.map(layer => layer.file).filter(file => read.some(key => layers.sources[key] === file))
  const overridden = MAIL_KEYS.flatMap(key => layers.unreadable[key] ? [{ key, file: layers.unreadable[key]! }] : [])

  return {
    revision: layers.revision,
    sources: sources.length ? sources : ['.env'],
    overridden,
    driver: normalizedDriver(entries.MAIL_MAILER ?? entries.MAIL_DRIVER),
    fromName: entries.MAIL_FROM_NAME ?? entries.APP_NAME ?? 'Stacks',
    fromAddress: entries.MAIL_FROM_ADDRESS ?? '',
    smtp: {
      host: entries.MAIL_HOST ?? '127.0.0.1',
      port: portValue(entries.MAIL_PORT),
      username: entries.MAIL_USERNAME === 'null' ? '' : entries.MAIL_USERNAME || '',
      encryption: normalizedEncryption(entries.MAIL_ENCRYPTION),
      passwordConfigured: configured(entries.MAIL_PASSWORD),
    },
    ses: {
      region: entries.AWS_SES_REGION ?? entries.AWS_DEFAULT_REGION ?? 'us-east-1',
      accessKeyId: entries.AWS_ACCESS_KEY_ID ?? '',
      secretAccessKeyConfigured: configured(entries.AWS_SECRET_ACCESS_KEY),
    },
    sendgrid: {
      apiKeyConfigured: configured(entries.SENDGRID_API_KEY),
    },
    mailgun: {
      domain: entries.MAILGUN_DOMAIN ?? '',
      endpoint: entries.MAILGUN_ENDPOINT ?? 'api.mailgun.net',
      apiKeyConfigured: configured(entries.MAILGUN_API_KEY),
    },
    mailtrap: {
      // Empty means the driver decides: the sandbox inbox when MAILTRAP_INBOX_ID
      // is set, real delivery through the Sending API when it is not.
      host: entries.MAILTRAP_HOST ?? '',
      inboxId: entries.MAILTRAP_INBOX_ID ?? '',
      tokenConfigured: configured(entries.MAILTRAP_TOKEN),
    },
  }
}

function validateSecret(value: unknown, field: string, fields: Record<string, string>): string {
  const secret = rawString(value)
  if (secret.length > 16_384)
    fields[field] = 'The secret must be 16 KB or smaller.'
  else if (/[\r\n\0]/.test(secret))
    fields[field] = 'The secret cannot contain line breaks or null bytes.'
  return secret
}

/**
 * What to write for a secret: a new value, an empty one to clear it, or
 * nothing to keep the stored one. Encrypting it, where its file is encrypted,
 * is `updateEnvironmentLayers`'s job, under that file's own public key.
 */
function secretUpdate(value: string, clear: boolean): string | undefined {
  if (value)
    return value
  if (clear)
    return ''
  return undefined
}

function validEmail(value: string): boolean {
  return /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value)
}

function validHost(value: string): boolean {
  return Boolean(value) && !/[\s\r\n\0]/.test(value)
}

export async function updateMailSettings(
  input: MailSettingsInput,
  options: EnvironmentLayersOptions = {},
): Promise<MailSettingsUpdateResult> {
  const fields: Record<string, string> = {}
  const revision = stringValue(input.revision)
  const driver = stringValue(input.driver)
  const fromName = stringValue(input.fromName)
  const fromAddress = stringValue(input.fromAddress)

  if (!/^[a-f0-9]{64}$/.test(revision))
    fields.revision = 'Reload the current settings before saving.'
  if (!MAIL_DRIVERS.includes(driver as MailDriver))
    fields.driver = 'Choose a supported mail driver.'
  if (fromName.length > 100)
    fields.fromName = 'The sender name must be 100 characters or fewer.'
  if (!validEmail(fromAddress))
    fields.fromAddress = 'Enter a valid sender email address.'

  const currentLayers = await readEnvironmentLayers(options)
  if (currentLayers.revision !== revision)
    return { conflict: true }

  const currentEntries = currentLayers.entries
  const updates: Record<string, string> = {
    MAIL_MAILER: driver,
    MAIL_FROM_NAME: fromName,
    MAIL_FROM_ADDRESS: fromAddress,
  }

  if (driver === 'smtp') {
    const host = stringValue(input.smtp?.host)
    const port = Number(input.smtp?.port)
    const username = stringValue(input.smtp?.username)
    const encryption = stringValue(input.smtp?.encryption)
    const password = validateSecret(input.smtp?.password, 'smtp.password', fields)
    const nextPassword = secretUpdate(password, input.smtp?.clearPassword === true)

    if (!validHost(host))
      fields['smtp.host'] = 'Enter a valid SMTP host.'
    if (!Number.isInteger(port) || port < 1 || port > 65535)
      fields['smtp.port'] = 'Enter a port from 1 to 65535.'
    if (encryption && encryption !== 'tls' && encryption !== 'ssl')
      fields['smtp.encryption'] = 'Encryption must be none, TLS, or SSL.'

    updates.MAIL_HOST = host
    updates.MAIL_PORT = String(port)
    updates.MAIL_USERNAME = username || 'null'
    updates.MAIL_ENCRYPTION = encryption || 'null'
    if (nextPassword !== undefined)
      updates.MAIL_PASSWORD = nextPassword
  }
  else if (driver === 'ses') {
    const region = stringValue(input.ses?.region)
    const accessKeyId = stringValue(input.ses?.accessKeyId)
    const secret = validateSecret(input.ses?.secretAccessKey, 'ses.secretAccessKey', fields)
    const nextSecret = secretUpdate(secret, input.ses?.clearSecretAccessKey === true)

    if (!/^[a-z]{2}(?:-gov)?-[a-z]+-\d$/.test(region))
      fields['ses.region'] = 'Enter a valid AWS region, such as us-east-1.'

    updates.AWS_SES_REGION = region
    updates.AWS_ACCESS_KEY_ID = accessKeyId
    if (nextSecret !== undefined)
      updates.AWS_SECRET_ACCESS_KEY = nextSecret
  }
  else if (driver === 'sendgrid') {
    const apiKey = validateSecret(input.sendgrid?.apiKey, 'sendgrid.apiKey', fields)
    const nextApiKey = secretUpdate(apiKey, input.sendgrid?.clearApiKey === true)

    if (!apiKey && input.sendgrid?.clearApiKey !== true && !configured(currentEntries.SENDGRID_API_KEY))
      fields['sendgrid.apiKey'] = 'Enter a SendGrid API key.'
    if (input.sendgrid?.clearApiKey === true && !apiKey)
      fields['sendgrid.apiKey'] = 'SendGrid requires an API key while it is selected.'
    if (nextApiKey !== undefined)
      updates.SENDGRID_API_KEY = nextApiKey
  }
  else if (driver === 'mailgun') {
    const domain = stringValue(input.mailgun?.domain)
    const endpoint = stringValue(input.mailgun?.endpoint)
    const apiKey = validateSecret(input.mailgun?.apiKey, 'mailgun.apiKey', fields)
    const nextApiKey = secretUpdate(apiKey, input.mailgun?.clearApiKey === true)

    if (!validHost(domain))
      fields['mailgun.domain'] = 'Enter the verified Mailgun domain.'
    if (!validHost(endpoint))
      fields['mailgun.endpoint'] = 'Enter a valid Mailgun API host.'
    if (!apiKey && input.mailgun?.clearApiKey !== true && !configured(currentEntries.MAILGUN_API_KEY))
      fields['mailgun.apiKey'] = 'Enter a Mailgun API key.'
    if (input.mailgun?.clearApiKey === true && !apiKey)
      fields['mailgun.apiKey'] = 'Mailgun requires an API key while it is selected.'

    updates.MAILGUN_DOMAIN = domain
    updates.MAILGUN_ENDPOINT = endpoint
    if (nextApiKey !== undefined)
      updates.MAILGUN_API_KEY = nextApiKey
  }
  else if (driver === 'mailtrap') {
    const host = stringValue(input.mailtrap?.host)
    const inboxId = stringValue(input.mailtrap?.inboxId)
    const token = validateSecret(input.mailtrap?.token, 'mailtrap.token', fields)
    const nextToken = secretUpdate(token, input.mailtrap?.clearToken === true)

    // Both optional, as in the driver: an inbox id captures mail in that
    // sandbox inbox, no inbox id delivers it through the Sending API, and a
    // blank host means Mailtrap's own host for whichever of the two it is.
    if (host) {
      try {
        const url = new URL(host)
        if (url.protocol !== 'https:')
          fields['mailtrap.host'] = 'Mailtrap API requests must use HTTPS.'
        else if (/sandbox\.api\.mailtrap\.io$/i.test(url.hostname) && !inboxId)
          fields['mailtrap.inboxId'] = 'The Mailtrap sandbox needs the inbox ID to capture into. Leave the host blank to deliver mail instead.'
      }
      catch {
        fields['mailtrap.host'] = 'Enter a valid Mailtrap API URL.'
      }
    }
    if (inboxId && (!/^\d+$/.test(inboxId) || Number(inboxId) < 1))
      fields['mailtrap.inboxId'] = 'Enter a positive Mailtrap inbox ID, or leave it blank to deliver mail.'
    if (!token && input.mailtrap?.clearToken !== true && !configured(currentEntries.MAILTRAP_TOKEN))
      fields['mailtrap.token'] = 'Enter a Mailtrap API token.'
    if (input.mailtrap?.clearToken === true && !token)
      fields['mailtrap.token'] = 'Mailtrap requires an API token while it is selected.'

    updates.MAILTRAP_HOST = host
    updates.MAILTRAP_INBOX_ID = inboxId
    if (nextToken !== undefined)
      updates.MAILTRAP_TOKEN = nextToken
  }

  if (Object.keys(fields).length)
    return { validation: { fields } }

  // Each value goes back to the env file the app reads it from, encrypted
  // where that file keeps it encrypted (stacksjs/stacks#3340).
  const result = await updateEnvironmentLayers(updates, revision, { ...options, secrets: SECRET_KEYS })
  if (result.conflict)
    return { conflict: true }
  if (result.issues?.length) {
    return {
      validation: {
        fields: Object.fromEntries(result.issues.map(issue => [
          KEY_FIELDS[issue.key] ?? issue.key,
          issue.message,
        ])),
      },
    }
  }

  return { state: await readMailSettings(options) }
}
