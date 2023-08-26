import type { Middlewares } from '@stacksjs/types'

export default <Middlewares> {
  logger: () => {
    console.log('logger middleware')
  },
  auth: () => {
    console.log('auth middleware')
  },
}
