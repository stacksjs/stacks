import { envVariables } from '@stacksjs/validation'
import type { StacksEnv } from '@stacksjs/validation'

envVariables.parse(process.env)

declare global {
  namespace NodeJS {
    interface ProcessEnv extends StacksEnv {}
  }
}
