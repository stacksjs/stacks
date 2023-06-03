import { envValidations } from '@stacksjs/validation'
import type { StacksEnv } from '@stacksjs/validation'

envValidations.parse(process.env)

declare global {
  namespace NodeJS {
    interface ProcessEnv extends StacksEnv {}
  }
}
