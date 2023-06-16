import * as process from 'node:process'
import type { ZodIssue } from 'zod'
import { z as validate, z } from 'zod'
import { log } from '@stacksjs/logging'
import { handleError } from '@stacksjs/error-handling'
import { generateError, safeParse } from 'zod-error'
import type { ErrorMessageOptions } from 'zod-error'

export const errorMessageOptions: ErrorMessageOptions = {
  maxErrors: 2,
  delimiter: {
    component: ' - ',
  },
  path: {
    enabled: true,
    type: 'zodPathArray',
    label: 'Env Variable: ',
  },
  code: {
    enabled: false,
  },
  message: {
    enabled: true,
    label: '',
  },
}

// TODO: envSchema needs to be auto generated from the .env file
export const backendEnvSchema = validate.object({
  APP_NAME: validate.string().default('Stacks').optional(),
  APP_ENV: validate.enum(['local', 'development', 'staging', 'production']).default('local').optional(),
  APP_KEY: validate.string().optional(),
  APP_URL: validate.string().default('stacks.test'),
  APP_DEBUG: validate.enum(['true', 'false']).default('true').transform(Boolean).optional(),
  APP_SUBDOMAIN_API: validate.string().default('api').optional(),
  APP_SUBDOMAIN_DOCS: validate.string().default('docs').optional(),
  APP_SUBDOMAIN_LIBRARY: validate.string().default('library').optional(),
  APP_BUCKET: validate.string().optional(),

  DB_CONNECTION: validate.string().default('mysql').optional(),
  DB_HOST: validate.string().default('127.0.0.1').optional(),
  DB_PORT: validate.string().regex(/^\d*$/).default('3306').transform(Number).optional(),
  DB_DATABASE: validate.string().default('stacks').optional(),
  DB_USERNAME: validate.string().default('root').optional(),
  DB_PASSWORD: validate.string().optional(),

  SEARCH_ENGINE_DRIVER: validate.string().default('meilisearch').optional(),
  MEILISEARCH_HOST: validate.string().default('https://127.0.0.1:7700').optional(),
  MEILISEARCH_KEY: validate.string().optional(),

  CACHE_DRIVER: validate.enum(['dynamodb', 'memcached', 'redis']).default('redis').optional(),
  CACHE_PREFIX: validate.string().default('stacks').optional(),
  CACHE_TTL: validate.string().regex(/^\d*$/).default('3600').transform(Number).optional(),

  AWS_ACCESS_KEY_ID: validate.string().optional(),
  AWS_SECRET_ACCESS_KEY: validate.string().optional(),
  AWS_DEFAULT_REGION: validate.string().default('us-east-1').optional(),
  DYNAMODB_CACHE_TABLE: validate.string().default('cache').optional(),
  DYNAMODB_ENDPOINT: validate.string().optional(),

  MEMCACHED_PERSISTENT_ID: validate.string().optional(),
  MEMCACHED_USERNAME: validate.string().optional(),
  MEMCACHED_PASSWORD: validate.string().optional(),
  MEMCACHED_HOST: validate.string().default('127.0.0.1').optional(),
  MEMCACHED_PORT: validate.string().regex(/^\d*$/).default('11211').transform(Number).optional(),

  REDIS_HOST: validate.string().default('127.0.0.1').optional(),
  REDIS_PORT: validate.string().regex(/^\d*$/).default('6379').transform(Number).optional(),

  MAIL_FROM_NAME: validate.string().default('Stacks').optional(),
  MAIL_FROM_ADDRESS: validate.string().default('no-reply@stacksjs.dev').optional(),

  EMAILJS_HOST: validate.string().default('example.com').optional(),
  EMAILJS_USERNAME: validate.string().default('').optional(),
  EMAILJS_PASSWORD: validate.string().default('').optional(),
  EMAILJS_PORT: validate.string().regex(/^\d*$/).default('40').transform(Number).optional(),
  EMAILJS_SECURE: validate.enum(['true', 'false']).default('true').transform(Boolean).optional(),

  MAILGUN_API_KEY: validate.string().default('').optional(),
  MAILGUN_DOMAIN: validate.string().default('').optional(),
  MAILGUN_USERNAME: validate.string().default('').optional(),

  MAILJET_API_KEY: validate.string().default('').optional(),
  MAILJET_API_SECRET: validate.string().default('').optional(),

  MANDRILL_API_KEY: validate.string().default('').optional(),

  NETCORE_API_KEY: validate.string().default('').optional(),

  NODEMAILER_HOST: validate.string().default('').optional(),
  NODEMAILER_USERNAME: validate.string().default('').optional(),
  NODEMAILER_PASSWORD: validate.string().default('').optional(),
  NODEMAILER_PORT: validate.string().regex(/^\d*$/).default('587').transform(Number).optional(),
  NODEMAILER_SECURE: validate.enum(['true', 'false']).default('true').transform(Boolean).optional(),

  POSTMARK_API_TOKEN: validate.string().default('').optional(),
  POSTMARK_API_KEY: validate.string().default('').optional(),

  SENDGRID_API_KEY: validate.string().default('').optional(),
  SENDGRID_SENDER_NAME: validate.string().default('').optional(),

  SES_API_VERSION: validate.string().default('').optional(),
  SES_ACCESS_KEY_ID: validate.string().default('').optional(),
  SES_SECRET_ACCESS_KEY: validate.string().default('').optional(),
  SES_REGION: validate.string().default('').optional(),

  FROM_PHONE_NUMBER: validate.string().default('').optional(),
  TWILIO_ACCOUNT_SID: validate.string().default('').optional(),
  TWILIO_AUTH_TOKEN: validate.string().default('').optional(),

  VONAGE_API_KEY: validate.string().default('').optional(),
  VONAGE_API_SECRET: validate.string().default('').optional(),

  GUPSHUP_USER_ID: validate.string().default('').optional(),
  GUPSHUP_PASSWORD: validate.string().default('').optional(),

  PLIVO_ACCOUNT_ID: validate.string().default('').optional(),
  PLIVO_AUTH_TOKEN: validate.string().default('').optional(),

  SMS77_API_KEY: validate.string().default('').optional(),

  SNS_REGION: validate.string().default('').optional(),
  SNS_ACCESS_KEY_ID: validate.string().default('').optional(),
  SNS_SECRET_ACCESS_KEY: validate.string().default('').optional(),

  TELNYX_API_KEY: validate.string().default('').optional(),
  TELNYX_MESSAGE_PROFILE_ID: validate.string().default('').optional(),

  TERMII_API_KEY: validate.string().default('').optional(),

  SLACK_FROM: validate.string().default('').optional(),
  SLACK_APPLICATION_ID: validate.string().default('').optional(),
  SLACK_CLIENT_ID: validate.string().default('').optional(),
  SLACK_SECRET_KEY: validate.string().default('').optional(),

  MICROSOFT_TEAMS_APPLICATION_ID: validate.string().default('').optional(),
  MICROSOFT_TEAMS_CLIENT_ID: validate.string().default('').optional(),
  MICROSOFT_TEAMS_SECRET: validate.string().default('').optional(),
})

export const frontendEnvSchema = validate.object({
  FRONTEND_APP_ENV: validate.enum(['local', 'development', 'staging', 'production']).default('local').optional(),
  FRONTEND_APP_URL: validate.string().default('stacks.test').optional(),
})

export const envSchema = backendEnvSchema.merge(frontendEnvSchema)

export type BackendEnv = validate.infer<typeof backendEnvSchema>
export type BackendEnvKeys = keyof BackendEnv

export type FrontendEnv = validate.infer<typeof frontendEnvSchema>
export type FrontendEnvKeys = keyof FrontendEnv

export type Env = validate.infer<typeof envSchema>
export type EnvKeys = keyof Env

export type ValidationIssue = ZodIssue

export function env(options?: ErrorMessageOptions) {
  if (!options)
    options = errorMessageOptions

  try {
    return envSchema.parse(process.env)
  }
  catch (error) {
    const genericError = generateError(error, options)
    handleError(genericError)
    throw new Error('Invalid environment variables')
  }
}

export function safeEnv(env?: any, options = errorMessageOptions) {
  return safeParse(envSchema, env ?? process.env, options)
}

export function getEnvIssues(env?: any): ValidationIssue[] | void {
  const result = safeEnv(env ?? process.env, errorMessageOptions)

  if (!result.success) {
    const message = result.error.message
    log.error(message)
  }
}

export enum Type {
  String = 'String',
  Number = 'Number',
  Boolean = 'Boolean',
  Date = 'Date',
  Object = 'Object',
  Array = 'Array',
}

export { validate, z }
