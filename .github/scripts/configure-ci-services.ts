import { appendFileSync } from 'node:fs'

const versions = {
  POSTGRES_SERVICE_VERSION: '17.11',
  MYSQL_SERVICE_VERSION: '26.7.0',
  REDIS_SERVICE_VERSION: '8.8.0',
  DYNAMODB_SERVICE_VERSION: '3.3.0',
} as const

/** Carry the action's private services into every ordinary test invocation. */
export function configureCiServices(environment: Record<string, string | undefined>): Record<string, string> {
  const required = (name: string): string => {
    const value = environment[name]
    if (!value || /[\r\n]/.test(value))
      throw new Error(`Missing or invalid native CI service variable: ${name}`)
    return value
  }

  for (const [name, version] of Object.entries(versions)) {
    if (required(name) !== version)
      throw new Error(`Native CI service version mismatch: ${name}`)
  }

  const endpoint = (name: string, protocol: string, defaultPort: string, authenticated = true): string => {
    const value = required(name)
    const url = new URL(value)
    if (url.protocol !== protocol || url.hostname !== '127.0.0.1'
      || !/^\d+$/.test(url.port) || Number(url.port) <= 1024 || Number(url.port) > 65535
      || url.port === defaultPort || url.hash || (authenticated && (!url.username || !url.password)))
      throw new Error(`Expected a private native CI service URL: ${name}`)
    return value
  }

  const mysql = endpoint('MYSQL_URL', 'mysql:', '3306')
  if (new URL(mysql).searchParams.get('ssl') !== 'true')
    throw new Error('Native CI MySQL requires TLS')
  const postgres = endpoint('POSTGRES_URL', 'postgres:', '5432')
  const redis = endpoint('REDIS_URL', 'redis:', '6379')
  const dynamodb = endpoint('DYNAMODB_URL', 'http:', '8000', false)
  const local = new URL(dynamodb)
  if (local.username || local.password || local.pathname !== '/' || local.search)
    throw new Error('Expected a private native CI DynamoDB endpoint')

  return {
    STACKS_TEST_MYSQL_URL: mysql,
    STACKS_TEST_POSTGRES_URL: postgres,
    STACKS_TEST_REDIS_URL: redis,
    AWS_DYNAMODB_ENDPOINT: dynamodb,
    AWS_ENDPOINT_URL: dynamodb,
    AWS_REGION: required('DYNAMODB_REGION'),
    AWS_DEFAULT_REGION: required('DYNAMODB_REGION'),
    AWS_ACCESS_KEY_ID: required('DYNAMODB_ACCESS_KEY_ID'),
    AWS_SECRET_ACCESS_KEY: required('DYNAMODB_SECRET_ACCESS_KEY'),
    AWS_SESSION_TOKEN: '',
  }
}

if (import.meta.main) {
  const destination = process.env.GITHUB_ENV
  if (!destination)
    throw new Error('GITHUB_ENV is required to configure native CI services')
  const environment = configureCiServices(process.env)
  appendFileSync(destination, Object.entries(environment).map(([name, value]) => `${name}=${value}\n`).join(''))
  console.log('Configured private PostgreSQL, MySQL TLS, Redis and DynamoDB test services')
}
