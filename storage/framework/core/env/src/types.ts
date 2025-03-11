import type { Infer, VineBoolean, VineEnum, VineNumber, VineString } from '@stacksjs/validation'
import type { SchemaTypes } from '@vinejs/vine/types'
import type { EnvKey } from '../../../env'
import { schema } from '@stacksjs/validation'
import env from '~/env'

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
  validation: VineString
  default: string
}

interface NumberEnvConfig {
  validation: VineNumber
  default: number
}

interface BooleanEnvConfig {
  validation: VineBoolean
  default: boolean
}

interface EnumEnvConfig {
  validation: VineEnum<any>
  default: string
}

type EnvValueConfig = StringEnvConfig | NumberEnvConfig | BooleanEnvConfig | EnumEnvConfig

export type EnvConfig = Partial<Record<EnvKey, EnvValueConfig>>

type EnvMap = Record<string, SchemaTypes>

const envStructure: EnvMap = Object.entries(env).reduce((acc, [key, value]) => {
  if (typeof value === 'object' && value !== null && 'validation' in value) {
    acc[key] = (value as EnvValueConfig).validation
    return acc
  }

  let validatorType: SchemaTypes
  switch (typeof value) {
    case 'string':
      validatorType = schema.string()
      break
    case 'number':
      validatorType = schema.number()
      break
    case 'boolean':
      validatorType = schema.boolean()
      break
    default:
      if (Array.isArray(value)) {
        validatorType = schema.enum(value as string[])
        break
      }

      // check if is on object
      if (typeof value === 'object' && value !== null) {
        const schemaNameSymbol = Symbol.for('schema_name')
        const schemaName = (value as { [key: symbol]: string })[schemaNameSymbol]

        if (schemaName === 'vine.string') {
          validatorType = schema.string()
          break
        }

        if (schemaName === 'vine.number') {
          validatorType = schema.number()
          break
        }

        if (schemaName === 'vine.boolean') {
          validatorType = schema.boolean()
          break
        }

        if (!schemaName && key in envEnum) {
          validatorType = schema.enum(envEnum[key as keyof typeof envEnum])
          break
        }

        console.error('Unknown env value type', typeof value)
      }

      throw new Error(`Invalid env value for ${key}`)
  }

  acc[key] = validatorType
  return acc
}, {} as EnvMap)

export const envSchema: ReturnType<typeof schema.object> = schema.object(envStructure)
export type Env = Infer<typeof envSchema>

export type EnvOptions = Env

export interface FrontendEnv {
  FRONTEND_APP_ENV: 'local' | 'development' | 'staging' | 'production'
  FRONTEND_APP_URL: string
}
export type FrontendEnvKeys = keyof FrontendEnv
