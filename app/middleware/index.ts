import type { Middlewares } from '@stacksjs/types'

const logger = await import('./logger')

export default <Middlewares> {
  logger: () => logger,
  auth: () => {
    // eslint-disable-next-line no-console
    console.log('auth middleware')
  },
}
