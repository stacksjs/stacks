import process from 'node:process'
import { loadEnv } from 'vite'
import { projectPath } from '@stacksjs/path'

export interface Env {
  APP_NAME: string
  APP_ENV: 'development' | 'staging' | 'production'
  APP_KEY: string
  APP_URL: string
  APP_DEBUG: boolean
  APP_SUBDOMAIN_API: string
  APP_SUBDOMAIN_DOCS: string
  APP_SUBDOMAIN_LIBRARY: string
  APP_BUCKET: string

  DB_CONNECTION: string
  DB_HOST: string
  DB_PORT: number
  DB_DATABASE: string
  DB_USERNAME: string
  DB_PASSWORD: string

  SEARCH_ENGINE_DRIVER: string
  MEILISEARCH_HOST: string
  MEILISEARCH_KEY: string

  CACHE_DRIVER: 'dynamodb' | 'memcached' | 'redis'
  CACHE_PREFIX: string
  CACHE_TTL: number

  AWS_ACCOUNT_ID: string
  AWS_ACCESS_KEY_ID: string
  AWS_SECRET_ACCESS_KEY: string
  AWS_DEFAULT_REGION: string
  DYNAMODB_CACHE_TABLE: string
  DYNAMODB_ENDPOINT: string

  MEMCACHED_PERSISTENT_ID: string
  MEMCACHED_USERNAME: string
  MEMCACHED_PASSWORD: string
  MEMCACHED_HOST: string
  MEMCACHED_PORT: number

  REDIS_HOST: string
  REDIS_PORT: number

  MAIL_FROM_NAME: string
  MAIL_FROM_ADDRESS: string

  EMAILJS_HOST: string
  EMAILJS_USERNAME: string
  EMAILJS_PASSWORD: string
  EMAILJS_PORT: number
  EMAILJS_SECURE: boolean

  MAILGUN_API_KEY: string
  MAILGUN_DOMAIN: string
  MAILGUN_USERNAME: string

  MAILJET_API_KEY: string
  MAILJET_API_SECRET: string

  MANDRILL_API_KEY: string

  NETCORE_API_KEY: string

  NODEMAILER_HOST: string
  NODEMAILER_USERNAME: string
  NODEMAILER_PASSWORD: string
  NODEMAILER_PORT: number
  NODEMAILER_SECURE: boolean

  POSTMARK_API_TOKEN: string
  POSTMARK_API_KEY: string

  SENDGRID_API_KEY: string
  SENDGRID_SENDER_NAME: string

  SES_API_VERSION: string
  SES_ACCESS_KEY_ID: string
  SES_SECRET_ACCESS_KEY: string
  SES_REGION: string

  FROM_PHONE_NUMBER: string
  TWILIO_ACCOUNT_SID: string
  TWILIO_AUTH_TOKEN: string

  VONAGE_API_KEY: string
  VONAGE_API_SECRET: string

  GUPSHUP_USER_ID: string
  GUPSHUP_PASSWORD: string

  PLIVO_ACCOUNT_ID: string
  PLIVO_AUTH_TOKEN: string

  SMS77_API_KEY: string

  SNS_REGION: string
  SNS_ACCESS_KEY_ID: string
  SNS_SECRET_ACCESS_KEY: string

  TELNYX_API_KEY: string
  TELNYX_MESSAGE_PROFILE_ID: string

  TERMII_API_KEY: string

  SLACK_FROM: string
  SLACK_APPLICATION_ID: string
  SLACK_CLIENT_ID: string
  SLACK_SECRET_KEY: string

  MICROSOFT_TEAMS_APPLICATION_ID: string
  MICROSOFT_TEAMS_CLIENT_ID: string
  MICROSOFT_TEAMS_SECRET: string
}

export interface FrontendEnv {
  FRONTEND_APP_ENV: 'local' | 'development' | 'staging' | 'production'
  FRONTEND_APP_URL: string
}

export type EnvKeys = keyof Env
export type FrontendEnvKeys = keyof FrontendEnv

const cache: { [key: string]: any } = {}

const handler = {
  get(target: NodeJS.ProcessEnv, prop: string) {
    if (prop in cache)
      return cache[prop]

    const newEnv = loadEnv('development', projectPath(), '') as (NodeJS.ProcessEnv & Env)
    cache[prop] = newEnv[prop]
    return newEnv[prop]
  },

  set(target: NodeJS.ProcessEnv, prop: string, value: string) {
    // const newEnv = loadEnv('development', projectPath(), '')
    if (prop in target) {
      process.env[prop] = value
      cache[prop] = value
      return true
    }
    else {
      throw new Error(`Cannot set property ${prop} because it doesn't exist in the env object, or it's a const.`)
    }
  },
}

export { loadEnv }

export const env: Env = new Proxy(process.env, handler) // fancy way to call `env` instead of `env()`
