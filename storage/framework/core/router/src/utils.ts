import { ok } from '@stacksjs/error-handling'
import { route } from './router'

export async function listRoutes() {
  const routeLists = await route.getRoutes()

  console.table(routeLists)

  return ok('Successfully listed routes!')
}
