import { log } from '@stacksjs/cli'
import { Middleware } from '@stacksjs/router'

export default new Middleware({
  name: 'Logger',
  priority: 2,
  handle() {
    log.info('Logger middleware')
  },
})
