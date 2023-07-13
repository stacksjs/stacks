import type { Env } from '@stacksjs/validation'

declare global {
  namespace NodeJS {
    interface ProcessEnv extends Env {}
  }
}
