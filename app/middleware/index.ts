import type { Middlewares } from '@stacksjs/types'

export default <Middlewares> {
  logger: () => {
    // eslint-disable-next-line no-console
    console.log('logger middleware')
  },
  auth: () => {
    // eslint-disable-next-line no-console
    console.log('auth middleware')
  },
}
