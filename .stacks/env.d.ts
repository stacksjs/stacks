import { validate } from './core/validation/src'

const envVariables = validate.object({
  APP_NAME: validate.string().default('Stacks').optional(),
  APP_ENV: validate.string().default('local').optional(),
  APP_KEY: validate.string(),
  APP_URL: validate.string().url().default('http://localhost:3333'),
  APP_DEBUG: validate.boolean().default(true),
  DB_CONNECTION: validate.string().default('mysql').optional(),
  DB_DATABASE: validate.string().default('stacks').optional(),
  DB_USERNAME: validate.string().default('root').optional(),
  DB_PASSWORD: validate.string().optional(),
  SEARCH_ENGINE_DRIVER: validate.string().optional(),
  MEILISEARCH_HOST: validate.string().optional().default('http://127.0.0.1:7700'),
  MEILISEARCH_KEY: validate.string().optional(),
})

type StacksEnv = validate.infer<typeof envVariables>

envVariables.parse(process.env)

declare global {
  namespace NodeJS {
    interface ProcessEnv extends StacksEnv {}
  }
}
