import type { Infer, VineBoolean, VineEnum, VineNumber, VineString } from '@stacksjs/validation'
import { validator } from '@stacksjs/validation'
import type { EnvKey } from '../../../env'
import env from '~/config/env'

// import type { Validate } from '@stacksjs/validation'

// we need to get this just into right format so we can infer the type
type EnvValue = string | boolean | number | readonly string[]
type EnvType = typeof env
type EnvKeys = keyof EnvType
type EnvMap = { [K in EnvKeys]: EnvType[K] extends string ? VineString :
  EnvType[K] extends number ? VineNumber :
    EnvType[K] extends boolean ? VineBoolean :
      EnvType[K] extends readonly string[] ? VineEnum<string[]> : unknown }

type ValidatorType = VineString | VineNumber | VineBoolean | VineEnum<string[]>

const envStructure = Object.entries(env).reduce((acc, [key, value]) => {
  let validatorType: ValidatorType
  switch (typeof value) {
    case 'string':
      validatorType = validator.string()
      break
    case 'number':
      validatorType = validator.number()
      break
    case 'boolean':
      validatorType = validator.boolean()
      break
    default:
      if (Array.isArray(value)) {
        validatorType = validator.enum(value as string[])
        break
      }
      throw new Error(`Invalid env value for ${key}`)
  }
  const envKey = key as EnvKeys

  acc[envKey] = validatorType as any
  return acc
}, {} as EnvMap)

export const envSchema = validator.object(envStructure)
export type Env = Infer<typeof envSchema>

export type EnvOptions = Env
export type EnvConfig = Partial<Record<EnvKey, EnvValue>>

export interface FrontendEnv {
  FRONTEND_APP_ENV: 'local' | 'development' | 'staging' | 'production'
  FRONTEND_APP_URL: string
}
export type FrontendEnvKeys = keyof FrontendEnv
