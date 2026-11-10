/**
 * Prints the paths the framework's default route file registers, with the
 * cms and commerce features forced on or off (argv[2] = 'on' | 'off').
 *
 * Its own process, because `feature()` is read once, at registration: a route
 * file imported twice in one process registers nothing the second time.
 */
import { disableFeature, enableFeature } from '@stacksjs/config'

const on = process.argv[2] === 'on'
for (const name of ['cms', 'commerce'] as const) {
  if (on)
    enableFeature(name)
  else
    disableFeature(name)
}

const { route } = await import('@stacksjs/router')
await import('../../../storage/framework/defaults/routes/dashboard.ts')

const routes = (route as unknown as { routes: Array<{ path: string }> }).routes
console.log(JSON.stringify(routes.map(entry => entry.path)))
