import type { BooleanValidatorType, EnumValidatorType, NumberValidatorType, StringValidatorType } from '@stacksjs/ts-validation'
import type { schema } from '@stacksjs/validation'
import type { EnvKey } from '../../../env'
import env from '~/config/env'

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

type EnvMap = Record<string, string>

const _envStructure: EnvMap = Object.entries(env).reduce((acc, [key, value]) => {
  if (typeof value === 'object' && value !== null && 'validation' in value) {
    acc[key] = (value as EnvValueConfig).validation.name
    return acc
  }

  let typeName: string
  switch (typeof value) {
    case 'string':
      typeName = 'string'
      break
    case 'number':
      typeName = 'number'
      break
    case 'boolean':
      typeName = 'boolean'
      break
    default:
      if (Array.isArray(value)) {
        typeName = 'enum'
        break
      }

      // check if is on object
      if (typeof value === 'object' && value !== null) {
        const schemaName = (value as { name: string }).name

        if (schemaName === 'string' || schemaName === 'number' || schemaName === 'boolean') {
          typeName = schemaName
          break
        }

        if (!schemaName && key in envEnum) {
          typeName = 'enum'
          break
        }

        console.error('Unknown env value type', typeof value)
      }

      throw new Error(`Invalid env value for ${key}`)
  }

  acc[key] = typeName
  return acc
}, {} as Record<string, string>)

export type Env = {
  [K in keyof typeof _envStructure]: typeof _envStructure[K]
}

export type EnvSchema = ReturnType<typeof schema.object<typeof _envStructure>>

export interface FrontendEnv {
  FRONTEND_APP_ENV: 'local' | 'development' | 'staging' | 'production'
  FRONTEND_APP_URL: string
}
export type FrontendEnvKeys = keyof FrontendEnv
