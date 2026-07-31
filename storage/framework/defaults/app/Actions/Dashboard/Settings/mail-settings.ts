import { encryptValue } from '@stacksjs/env'
import {
  parseEnvironmentEntries,
  readEnvironmentFile,
  updateEnvironmentEntries,
  validateEnvironmentFile,
} from '../Infrastructure/environment-file'
import type { EnvironmentFileOptions } from '../Infrastructure/environment-file'

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

export interface MailSettingsInput {
  revision: unknown
  driver: unknown
  fromName: unknown
  fromAddress: unknown
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

export async function readMailSettings(options: EnvironmentFileOptions = {}): Promise<MailSettingsState> {
  const environment = await readEnvironmentFile(options)
  const environmentIssues = validateEnvironmentFile(environment.content)
  if (environmentIssues.length) {
    const issue = environmentIssues[0]!
    const location = issue.line > 0 ? ` on line ${issue.line}` : ''
    throw new TypeError(`The environment file is invalid${location}: ${issue.message}`)
  }
  const entries = parseEnvironmentEntries(environment.content)

  return {
    revision: environment.revision,
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
      host: entries.MAILTRAP_HOST ?? 'https://sandbox.api.mailtrap.io/api/send',
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

function secretUpdate(
  entries: Record<string, string>,
  key: typeof SECRET_KEYS[number],
  value: string,
  clear: boolean,
  fields: Record<string, string>,
): string | undefined {
  if (value) {
    const encryptedFile = Object.values(entries).some(entry =>
      entry.startsWith('encrypted:') || entry.startsWith('enc:'),
    )
    if (!encryptedFile)
      return value

    const publicKey = entries.DOTENV_PUBLIC_KEY
    if (!publicKey) {
      fields[key] = 'The encrypted environment file has no public key. Repair it before changing secrets.'
      return undefined
    }

    try {
      return encryptValue(value, publicKey)
    }
    catch {
      fields[key] = 'The secret could not be encrypted with the environment public key.'
      return undefined
    }
  }

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
  options: EnvironmentFileOptions = {},
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

  const currentEnvironment = await readEnvironmentFile(options)
  if (currentEnvironment.revision !== revision)
    return { conflict: true }

  const currentEntries = parseEnvironmentEntries(currentEnvironment.content)
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
    const nextPassword = secretUpdate(
      currentEntries,
      'MAIL_PASSWORD',
      password,
      input.smtp?.clearPassword === true,
      fields,
    )

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
    const nextSecret = secretUpdate(
      currentEntries,
      'AWS_SECRET_ACCESS_KEY',
      secret,
      input.ses?.clearSecretAccessKey === true,
      fields,
    )

    if (!/^[a-z]{2}(?:-gov)?-[a-z]+-\d$/.test(region))
      fields['ses.region'] = 'Enter a valid AWS region, such as us-east-1.'

    updates.AWS_SES_REGION = region
    updates.AWS_ACCESS_KEY_ID = accessKeyId
    if (nextSecret !== undefined)
      updates.AWS_SECRET_ACCESS_KEY = nextSecret
  }
  else if (driver === 'sendgrid') {
    const apiKey = validateSecret(input.sendgrid?.apiKey, 'sendgrid.apiKey', fields)
    const nextApiKey = secretUpdate(
      currentEntries,
      'SENDGRID_API_KEY',
      apiKey,
      input.sendgrid?.clearApiKey === true,
      fields,
    )

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
    const nextApiKey = secretUpdate(
      currentEntries,
      'MAILGUN_API_KEY',
      apiKey,
      input.mailgun?.clearApiKey === true,
      fields,
    )

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
    const nextToken = secretUpdate(
      currentEntries,
      'MAILTRAP_TOKEN',
      token,
      input.mailtrap?.clearToken === true,
      fields,
    )

    try {
      const url = new URL(host)
      if (url.protocol !== 'https:')
        fields['mailtrap.host'] = 'Mailtrap API requests must use HTTPS.'
    }
    catch {
      fields['mailtrap.host'] = 'Enter a valid Mailtrap API URL.'
    }
    if (!/^\d+$/.test(inboxId) || Number(inboxId) < 1)
      fields['mailtrap.inboxId'] = 'Enter a positive Mailtrap inbox ID.'
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

  const result = await updateEnvironmentEntries(updates, revision, options)
  if (result.conflict)
    return { conflict: true }
  if (result.issues?.length) {
    return {
      validation: {
        fields: Object.fromEntries(result.issues.map((issue, index) => [
          issue.line ? String(issue.line) : `file-${index}`,
          issue.message,
        ])),
      },
    }
  }

  return { state: await readMailSettings(options) }
}
