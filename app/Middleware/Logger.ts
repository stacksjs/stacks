import { log } from '@stacksjs/cli'
import { Middleware } from '@stacksjs/router'

export default new Middleware({
  name: 'logger',
  priority: 1,
  handle() {
    log.info('logger middleware')
  },
})
