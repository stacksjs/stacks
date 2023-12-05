import { log } from 'stacks:cli'
import { Middleware } from 'stacks:router'

export default new Middleware({
  name: 'logger',
  priority: 1,
  handle() {
    log.info('logger middleware')
  },
})
