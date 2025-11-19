import type { BooleanValidatorType, EnumValidatorType, NumberValidatorType, StringValidatorType } from '@stacksjs/ts-validation'
import type { schema } from '@stacksjs/validation'
import type { EnvKey } from '../../../env'

interface EnumObject {
  [key: string]: string[]
}

export const envEnum: EnumObject = {
  APP_ENV: ['local', 'dev', 'development', 'staging', 'prod', 'production'],
  DB_CONNECTION: ['mysql', 'sqlite', 'postgres', 'dynamodb'],
  MAIL_MAILER: ['smtp', 'mailgun', 'ses', 'postmark', 'sendmail', 'log'],
  SEARCH_ENGINE_DRIVER: ['opensearch'],
  FRONTEND_APP_ENV: ['development', 'staging', 'production'],
}

interface StringEnvConfig {
  validation: StringValidatorType
  default: string
}

interface NumberEnvConfig {
  validation: NumberValidatorType
  default: number
}

interface BooleanEnvConfig {
  validation: BooleanValidatorType
  default: boolean
}

interface EnumEnvConfig {
  validation: EnumValidatorType
  default: string
}

type EnvValueConfig = StringEnvConfig | NumberEnvConfig | BooleanEnvConfig | EnumEnvConfig

export type EnvConfig = Partial<Record<EnvKey, EnvValueConfig>>

export type Env = Record<string, any>

export type EnvSchema = any

export interface FrontendEnv {
  FRONTEND_APP_ENV: 'local' | 'development' | 'staging' | 'production'
  FRONTEND_APP_URL: string
}
export type FrontendEnvKeys = keyof FrontendEnv
