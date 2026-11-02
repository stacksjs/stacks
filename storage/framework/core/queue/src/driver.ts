import { env } from '@stacksjs/env'

/** One driver policy for dispatchers and workers, including production durability. */
export function resolveQueueDriver(driver: string | undefined = env.QUEUE_DRIVER, environment: string | undefined = env.APP_ENV): 'sync' | 'database' | 'redis' {
  const production = environment === 'production'
  const selected = driver || (production ? 'database' : 'sync')
  if (!['sync', 'database', 'redis'].includes(selected))
    throw new Error(['sqs', 'memory', 'beanstalkd'].includes(selected)
      ? `[queue] Driver "${selected}" is not implemented yet. Set QUEUE_DRIVER to one of: redis, database, sync.`
      : `[queue] Unknown QUEUE_DRIVER "${selected}". Allowed values: redis, database, sync.`)
  if (production && selected === 'sync')
    throw new Error('[queue] Production requires a durable database or redis queue; sync executes inline.')
  return selected as 'sync' | 'database' | 'redis'
}
