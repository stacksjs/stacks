import process from 'node:process'
import { log } from '@stacksjs/logging'

const listRoutes: any = (await import('@stacksjs/router') as any).listRoutes

const result = await listRoutes()

if ((result as any)?.isErr) {
  console.error((result as any).error)
  log.error('Route lists failed', (result as any).error)
  process.exit(1)
}

process.exit(0)
