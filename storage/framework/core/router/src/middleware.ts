import { appPath } from '@stacksjs/path'
import type { MiddlewareType } from '@stacksjs/types'

export class Middleware implements MiddlewareType {
  name: string
  priority: number

  handle: Function

  constructor(data: MiddlewareType) {
    this.name = data.name
    this.priority = data.priority
    this.handle = data.handle
  }
}

// const readdir = promisify(fs.readdir)

async function importMiddlewares(directory: string) {
  // const middlewares = []
  // TODO: somehow this breaks ./buddy dev
  // const files = await readdir(directory)

  // for (const file of files) {
  //   // Dynamically import the middleware
  //   const imported = await import(path.join(directory, file))
  //   middlewares.push(imported.default)
  // }

  // return middlewares
  return [directory] // fix this: return array of middlewares
}

export const middlewares = await importMiddlewares(appPath('middleware'))
