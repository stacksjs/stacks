import { log } from '@stacksjs/cli'
import { Middleware } from '@stacksjs/router'
import { request } from '@stacksjs/router'

export default new Middleware({
  name: 'Bearer Token Authentication',
  priority: 1,
  handle() {
    log.info('Bearer Authentication middleware')
  },
})
