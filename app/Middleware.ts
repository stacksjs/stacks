import { defineMiddleware } from '@stacksjs/router'

/**
 * The application's middleware aliases.
 *
 * Aliases may be used instead of class names to conveniently assign middleware
 * to routes and groups. Each one names a class under `app/Middleware/`, or one
 * of the framework defaults behind it, and the name is checked.
 *
 * This map is MERGED over the framework defaults rather than replacing them,
 * so an alias the framework adds later is available here without an edit.
 *
 * Two forms are read off a reference before it is looked up:
 *
 *   - `!alias` inverts it: the route passes only when that middleware refuses.
 *     `'!auth'` is a guests-only route; `'!env:production'` is everywhere but
 *     production.
 *   - `alias:params` passes `params` to the middleware, but only when the
 *     whole string is not itself an alias - so `'env:production'` is the alias
 *     below and `'throttle:60,1'` passes `60,1` to `throttle`.
 *
 * A middleware with no alias is still reachable by its class name, which is how
 * `'signed'` worked before it was listed here.
 */
export default defineMiddleware({
  'maintenance': 'Maintenance',
  'cors': 'Cors',
  'auth': 'Auth',
  'guest': 'Guest',
  'api': 'Api',
  'team': 'Team',
  'site': 'Site',
  'logger': 'Logger',
  'abilities': 'Abilities',
  'can': 'Can',
  'throttle': 'Throttle',
  'signed': 'Signed',
  'env': 'Env',
  'env:local': 'EnvLocal',
  'env:development': 'EnvDevelopment',
  'env:dev': 'EnvDevelopment',
  'env:staging': 'EnvStaging',
  'env:production': 'EnvProduction',
  'env:prod': 'EnvProduction',
  'role': 'Role',
  'permission': 'Permission',
  'verified': 'EnsureEmailIsVerified',
  'csrf': 'Csrf',
  'compress': 'Compress',
  // Add more middleware aliases here
})
