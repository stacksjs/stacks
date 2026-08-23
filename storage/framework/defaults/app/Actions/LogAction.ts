import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { log } from '@stacksjs/logging'
import { response } from '@stacksjs/router'
import { schema } from '@stacksjs/validation'

type LogLevel = 'info' | 'warn' | 'error'

export default new Action({
  name: 'Dummy Logger',
  description: 'This action is used to demo how to POST to a server and upon success, log a message.',
  method: 'POST',
  apiResponse: true,

  // the request object is optional, but if it is provided, it will be used for validation
  validations: {
    message: {
      rule: schema.string().min(3).max(255).required(),
      message: 'The message must be between 3 and 255 characters long.',
    },

    level: {
      // `schema.string().in([...])` was a renamed/removed method
      // (stacksjs/stacks#1853) — the validator throws "schema.string().in
      // is not a function" at module evaluation. Use `schema.enum([...])`
      // — that's the working enum primitive used throughout the framework
      // defaults and in the typical project's models.
      rule: schema.enum(['info', 'warn', 'error']).required(),
      message: 'The log level must be one of "info", "warn", or "error".',
    },
  },

  async handle(request: RequestInstance) {
    await request.validate()

    const message = String(request.get('message') || '').trim()
    const level = String(request.get('level')) as LogLevel
    log[level](message)

    return response.json({ level, message: `Logged at ${level} level.` })
  },
})
