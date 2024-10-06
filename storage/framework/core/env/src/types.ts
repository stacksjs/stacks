import { log } from '@stacksjs/logging'
import { schema } from '@stacksjs/validation'
import type { Infer, VineBoolean, VineEnum, VineNumber, VineString } from '@stacksjs/validation'
import env from '~/config/env'
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

// we need to get this into the right format so we can infer the type
type EnvValue = string | boolean | number | readonly string[]
type EnvType = typeof env
type EnvKeys = keyof EnvType
type EnvMap = {
  [K in EnvKeys]: EnvType[K] extends string
    ? VineString
    : EnvType[K] extends number
      ? VineNumber
      : EnvType[K] extends boolean
        ? VineBoolean
        : EnvType[K] extends readonly string[]
          ? VineEnum<string[]>
          : unknown
}

type ValidatorType = VineString | VineNumber | VineBoolean | VineEnum<string[]>

const envStructure = Object.entries(env).reduce((acc, [key, value]) => {
  let validatorType: ValidatorType
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
      if (typeof value === 'object') {
        const schemaNameSymbol = Symbol.for('schema_name')
        const schemaName = value[schemaNameSymbol]
        // log.debug('value', value)
        // log.debug('schemaName', schemaName)

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

        // if (schemaName === 'vine.enum') {
        //   validatorType = schema.enum(value as string[])
        //   break
        // }

        // oddly, enums don't trigger schemaName === 'vine.enum'
        if (!schemaName) {
          validatorType = schema.enum(envEnum.APP_ENV)
          break
        }

        console.error('Unknown env value type', typeof value)
      }

      throw new Error(`Invalid env value for ${key}`)
  }
  const envKey = key as EnvKeys

  acc[envKey] = validatorType as any
  return acc
}, {} as EnvMap)

export const envSchema = schema.object(envStructure)
export type Env = Infer<typeof envSchema>

export type EnvOptions = Env
export type EnvConfig = Partial<Record<EnvKey, EnvValue>>

export interface FrontendEnv {
  FRONTEND_APP_ENV: 'local' | 'development' | 'staging' | 'production'
  FRONTEND_APP_URL: string
}
export type FrontendEnvKeys = keyof FrontendEnv
