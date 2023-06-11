import type { ZodIssue } from 'zod'
import { z as validate, z } from 'zod'

// TODO: envValidations needs to be auto generated from the .env file
export const backendEnvValidations = validate.object({
  APP_NAME: validate.string().default('Stacks'),
  APP_ENV: validate.enum(['local', 'development', 'staging', 'production']).default('local'),
  APP_KEY: validate.string().optional(),
  APP_URL: validate.string().url().default('stacks.test'),
  APP_DEBUG: validate.boolean().default(true),

  DB_CONNECTION: validate.string().default('mysql').optional(),
  DB_HOST: validate.string().default('127.0.0.1').optional(),
  DB_PORT: validate.number().default(3306).optional(),
  DB_DATABASE: validate.string().default('stacks').optional(),
  DB_USERNAME: validate.string().default('root').optional(),
  DB_PASSWORD: validate.string().optional(),

  SEARCH_ENGINE_DRIVER: validate.string().default('meilisearch').optional(),
  MEILISEARCH_HOST: validate.string().default('https://127.0.0.1:7700'),
  MEILISEARCH_KEY: validate.string().optional(),

  CACHE_DRIVER: validate.enum(['dynamodb', 'memcached', 'redis']).default('redis'),
  CACHE_PREFIX: validate.string().default('stacks'),
  CACHE_TTL: validate.number().default(3600),

  AWS_ACCESS_KEY_ID: validate.string().optional(),
  AWS_SECRET_ACCESS_KEY: validate.string().optional(),
  AWS_DEFAULT_REGION: validate.string().default('us-east-1').optional(),
  DYNAMODB_CACHE_TABLE: validate.string().default('cache').optional(),
  DYNAMODB_ENDPOINT: validate.string().optional(),

  MEMCACHED_PERSISTENT_ID: validate.string().optional(),
  MEMCACHED_USERNAME: validate.string().optional(),
  MEMCACHED_PASSWORD: validate.string().optional(),
  MEMCACHED_HOST: validate.string().default('127.0.0.1'),
  MEMCACHED_PORT: validate.number().default(11211),

  REDIS_HOST: validate.string().default('127.0.0.1'),
  REDIS_PORT: validate.number().default(6379),

  MAIL_FROM_NAME: validate.string().default('Stacks'),
  MAIL_FROM_ADDRESS: validate.string().default('no-reply@stacksjs.dev'),

  EMAILJS_HOST: validate.string().default('example.com'),
  EMAILJS_USERNAME: validate.string().default(''),
  EMAILJS_PASSWORD: validate.string().default(''),
  EMAILJS_PORT: validate.number().default(40),
  EMAILJS_SECURE: validate.boolean().default(true),

  MAILGUN_API_KEY: validate.string().default(''),
  MAILGUN_DOMAIN: validate.string().default(''),
  MAILGUN_USERNAME: validate.string().default(''),

  MAILJET_API_KEY: validate.string().default(''),
  MAILJET_API_SECRET: validate.string().default(''),

  MANDRILL_API_KEY: validate.string().default(''),

  NETCORE_API_KEY: validate.string().default(''),

  NODEMAILER_HOST: validate.string().default(''),
  NODEMAILER_USERNAME: validate.string().default(''),
  NODEMAILER_PASSWORD: validate.string().default(''),
  NODEMAILER_PORT: validate.number().default(587),
  NODEMAILER_SECURE: validate.boolean().default(true),

  POSTMARK_API_TOKEN: validate.string().default(''),
  POSTMARK_API_KEY: validate.string().default(''),

  SENDGRID_API_KEY: validate.string().default(''),
  SENDGRID_SENDER_NAME: validate.string().default(''),

  SES_API_VERSION: validate.string().default(''),
  SES_ACCESS_KEY_ID: validate.string().default(''),
  SES_SECRET_ACCESS_KEY: validate.string().default(''),
  SES_REGION: validate.string().default(''),

  FROM_PHONE_NUMBER: validate.string().default(''),
  TWILIO_ACCOUNT_SID: validate.string().default(''),
  TWILIO_AUTH_TOKEN: validate.string().default(''),

  VONAGE_API_KEY: validate.string().default(''),
  VONAGE_API_SECRET: validate.string().default(''),

  GUPSHUP_USER_ID: validate.string().default(''),
  GUPSHUP_PASSWORD: validate.string().default(''),

  PLIVO_ACCOUNT_ID: validate.string().default(''),
  PLIVO_AUTH_TOKEN: validate.string().default(''),

  SMS77_API_KEY: validate.string().default(''),

  SNS_REGION: validate.string().default(''),
  SNS_ACCESS_KEY_ID: validate.string().default(''),
  SNS_SECRET_ACCESS_KEY: validate.string().default(''),

  TELNYX_API_KEY: validate.string().default(''),
  TELNYX_MESSAGE_PROFILE_ID: validate.string().default(''),

  TERMII_API_KEY: validate.string().default(''),

  SLACK_FROM: validate.string().default(''),
  SLACK_APPLICATION_ID: validate.string().default(''),
  SLACK_CLIENT_ID: validate.string().default(''),
  SLACK_SECRET_KEY: validate.string().default(''),

  MICROSOFT_TEAMS_APPLICATION_ID: validate.string().default(''),
  MICROSOFT_TEAMS_CLIENT_ID: validate.string().default(''),
  MICROSOFT_TEAMS_SECRET: validate.string().default(''),
})
export const frontendEnvValidations = validate.object({
  FRONTEND_APP_ENV: z.string().default('local').optional(),
  FRONTEND_APP_URL: z.string().default('localhost').optional(),
})
export const envValidations = backendEnvValidations.merge(frontendEnvValidations)

export type BackendEnv = validate.infer<typeof backendEnvValidations>
export type BackendEnvKeys = keyof BackendEnv

export type FrontendEnv = validate.infer<typeof frontendEnvValidations>
export type FrontendEnvKeys = keyof FrontendEnv

export type Env = validate.infer<typeof envValidations>
export type EnvKeys = keyof Env

export type ValidationIssue = ZodIssue

export const env = envValidations.parse(process.env)
export const safeEnv = envValidations.safeParse(process.env)
export const frontendEnv = frontendEnvValidations.parse(process.env)
export const backendEnv = backendEnvValidations.parse(process.env)

export function getEnvIssues(): ValidationIssue[] | void {
  const result = safeEnv

  if (!result.success)
    return result.error.issues
}

// export const config = configUser

export enum Type {
  String = 'String',
  Number = 'Number',
  Boolean = 'Boolean',
  Date = 'Date',
  Object = 'Object',
  Array = 'Array',
}

export { validate, z }
