import type { Env } from '@stacksjs/env'

declare global {
  namespace NodeJS {
    interface ProcessEnv extends Env {
      // automatically added by Stacks based on your .env file
    }
  }
}
