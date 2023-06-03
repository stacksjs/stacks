import { z as validate, z } from 'zod'

export type ValidationIssue = z.ZodIssue

// TODO: envValidations needs to be auto generated from the .env file
export const envValidations = validate.object({
  APP_NAME: validate.string().default('Stacks'),
  APP_ENV: validate.enum(['local', 'development', 'staging', 'production']).default('local'),
  APP_KEY: validate.string(),
  APP_URL: validate.string().url().default('https://127.0.0.1:3333'),
  APP_DEBUG: validate.boolean().default(true),

  DB_CONNECTION: validate.string().default('mysql').optional(),
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
})

export type StacksEnv = validate.infer<typeof envValidations>
export type StacksEnvKeys = keyof StacksEnv

export const env = envValidations.parse(process.env)

export function getEnvIssues(): ValidationIssue[] | void {
  const result = env

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
