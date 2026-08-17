import type { EnhancedRequest } from '@stacksjs/bun-router'
import type { UserModel } from '@stacksjs/orm'

/**
 * The authenticated user for an authorization middleware to reason about.
 *
 * Every one of these middleware used to open with the same line:
 *
 *     const user = request.user || request._user || request._authenticatedUser
 *
 * Two things were wrong with it. `_user` is assigned nowhere in the framework,
 * so it was a dead term that only served to break the typecheck. And `user` is
 * a lazily-resolving MACRO - a function - so on any request that carries it,
 * `user` was the function itself: truthy enough to sail past the
 * "unauthenticated" check, then missing every field the middleware went on to
 * read, which surfaces as a confusing 403 rather than an honest 401.
 *
 * Resolving it in one place means the five middleware agree on what "the user"
 * is, and the answer is a user rather than a callable.
 */
export async function authenticatedUser(request: EnhancedRequest): Promise<UserModel | undefined> {
  const cached = request._authenticatedUser
  if (cached && typeof cached === 'object')
    return cached as UserModel

  const macro = request.user as unknown
  if (typeof macro === 'function') {
    const resolved = await (macro as () => Promise<unknown>)()
    return resolved && typeof resolved === 'object' ? resolved as UserModel : undefined
  }

  // A middleware upstream may have stamped a plain object on `user` instead.
  if (macro && typeof macro === 'object')
    return macro as UserModel

  return undefined
}
