import type { StacksEnv } from '@stacksjs/validation'

declare global {
  namespace NodeJS {
    interface ProcessEnv extends StacksEnv {}
  }
}
