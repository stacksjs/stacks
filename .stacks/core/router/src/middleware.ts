import fs from 'node:fs'
import path from 'node:path'
import { promisify } from 'node:util'
import type { MiddlewareType } from '@stacksjs/types'

export class Middleware implements MiddlewareType {
  name: string
  priority: number
  // eslint-disable-next-line @typescript-eslint/ban-types
  handle: Function

  constructor(data: MiddlewareType) {
    this.name = data.name
    this.priority = data.priority
    this.handle = data.handle
  }
}

const readdir = promisify(fs.readdir)

async function importMiddlewares(directory: any) {
  const middlewares = []
  const files = await readdir(directory)

  for (const file of files) {
    // Dynamically import the middleware
    const imported = await import(path.join(directory, file))
    middlewares.push(imported.default)
  }

  return middlewares
}

// Example usage:
const middlewareDirectory = path.join(__dirname, '../../../../app/middleware')

export const middlewares = await importMiddlewares(middlewareDirectory)
