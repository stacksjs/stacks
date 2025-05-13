import { Action } from '@stacksjs/actions'
import { log } from '@stacksjs/logging'
import { schema } from '@stacksjs/validation'

interface Request {
  message: string
  level: 'info' | 'warn' | 'error'
}

export default new Action({
  name: 'Dummy Logger',
  description: 'This action is used to demo how to POST to a server and upon success, log a message.',

  // the request object is optional, but if it is provided, it will be used for validation
  validations: {
    message: {
      rule: schema.string().min(3).max(255),
      message: 'The message must be between 3 and 255 characters long.',
    },

    level: {
      rule: schema.string().in(['info', 'warn', 'error']),
      message: 'The log level must be one of "info", "warn", or "error".',
    },
  },

  // handle(request: { message: string, level: 'info' | 'warn' | 'error' }) {
  handle(request?: Request) {
    if (!request)
      return 'No request was provided.'

    // TODO: need to vine validate
    log[request.level](request.message)

    return `Logged "${request.message}" at "${request.level}" level`
  },
})
