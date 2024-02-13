import { Action } from '@stacksjs/actions'
import { validator } from '@stacksjs/validation'
import { log } from '@stacksjs/logging'

export default new Action({
  name: 'Dummy Logger',
  description: 'This action is used to demo how to POST to a server and upon success, log a message.',

  fields: {
    message: {
      rule: validator.string().minLength(3).maxLength(255),
      message: 'The message must be between 3 and 255 characters long.',
    },

    level: {
      rule: validator.enum(['info', 'warn', 'error']),
      message: 'The log level must be one of "info", "warn", or "error".',
    },
  },

  // handle(request: { message: string, level: 'info' | 'warn' | 'error' }) {
  handle(request: Request) {
    log[request.level](request.message)

    return `Logged "${request.message}" at "${request.level}" level`
  },
})
