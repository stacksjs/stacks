/**
 * How the scaffold's authorization middleware are allowed to read "the user".
 *
 * stacksjs/stacks#2561: every one of them opened with
 *
 *     const user = request.user || request._user || request._authenticatedUser
 *
 * `request.user` is the lazily-resolving macro `enhanceRequest()` installs - a
 * FUNCTION. Truthy, so the `||` chain stopped there and the "unauthenticated"
 * check passed, then RBAC read `.id` off a function and every `role:` /
 * `permission:` guarded route answered 500. `_user` is assigned nowhere in the
 * framework at all.
 *
 * `authenticatedUser()` is the one place that resolves this correctly, and
 * core/auth/tests/authenticated-user.test.ts pins its behaviour. What is left
 * un-pinned is that the middleware actually ask it - so this asserts the shape
 * of the call site, which is what regressed.
 */

import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const MIDDLEWARE_DIR = join(import.meta.dir, '../../storage/framework/defaults/app/Middleware')

/** The middleware that answer "is this user allowed?" and so must resolve one. */
const AUTHORIZATION_MIDDLEWARE = ['Can', 'EnsureEmailIsVerified', 'Permission', 'Role', 'Team']

function source(name: string): string {
  return readFileSync(join(MIDDLEWARE_DIR, `${name}.ts`), 'utf8')
}

describe('authorization middleware resolve the user through authenticatedUser()', () => {
  for (const name of AUTHORIZATION_MIDDLEWARE) {
    test(`${name} awaits authenticatedUser(request)`, () => {
      const code = source(name)
      expect(code).toContain('authenticatedUser')
      expect(code).toMatch(/await authenticatedUser\(request\)/)
    })

    test(`${name} never reads request.user or request._user directly`, () => {
      const code = source(name)
      // `request.user` is a function; `request._user` does not exist. Reading
      // either is the #2561 bug, whichever way the fallback chain is written.
      expect(code).not.toMatch(/request\.user\b/)
      expect(code).not.toMatch(/request\._user\b/)
    })
  }
})
