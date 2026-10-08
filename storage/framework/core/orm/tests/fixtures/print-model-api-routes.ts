/**
 * Boots the real ORM route generator inside whatever project the working
 * directory is, and prints the paths it registered, plus the middleware each
 * one ended up with. Used by `model-api-selection.test.ts` and
 * `model-dashboard-roles.test.ts`, which run it against a throwaway project.
 *
 * The middleware is the half that cannot be inferred from the paths: a guarded
 * and an unguarded route are the same string, so a role gate is invisible
 * until it is printed next to the route it guards.
 */
import process from 'node:process'
import { log } from '@stacksjs/logging/runtime'
import { listRegisteredRoutes, route } from '@stacksjs/router'

await import('../../src/routes')

const paths = [...new Set((route.routes as Array<{ path: string }>).map(entry => entry.path))].sort()
const routes = listRegisteredRoutes()
  .map(entry => ({ route: `${entry.method} ${entry.path}`, middleware: entry.middleware ?? [] }))
  .sort((a, b) => a.route.localeCompare(b.route))
console.log(JSON.stringify({ paths, routes }))
// The generator's warnings are asynchronous; a server lives long enough to
// print them, a script that exits next does not.
await log.flush()
process.exit(0)
