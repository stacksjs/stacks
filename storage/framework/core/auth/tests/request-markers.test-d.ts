/**
 * What the Auth middleware stamps on a request reads back as what it is
 * (stacksjs/stacks#3236).
 *
 * `_authenticatedUser` and `_currentAccessToken` were declared `unknown`, so
 * every reader cast: the Abilities and Throttle middleware, the router's own
 * `tokenCan` and error handler, and any app middleware that wanted the user.
 * The token is `AccessToken` from `@stacksjs/types`. The user is whatever
 * `RequestTypeRegistry['user']` says, which `@stacksjs/auth` sets to the User
 * row it resolves: what `User.find` returns, so an app's own columns come
 * through.
 */

import type { EnhancedRequest } from '@stacksjs/bun-router'
import type { User } from '@stacksjs/orm'
import type { AccessToken, PersonalAccessToken, TokenScopes } from '@stacksjs/types'
import '@stacksjs/router'

declare const request: EnhancedRequest
declare const personal: PersonalAccessToken
type UserRow = NonNullable<Awaited<ReturnType<typeof User.find>>>

const user: UserRow | undefined = request._authenticatedUser
const email: string | undefined = request._authenticatedUser?.email
const id: number | undefined = request._authenticatedUser?.id
const token: AccessToken | undefined = request._currentAccessToken
const scopes: TokenScopes | undefined = request._currentAccessToken?.scopes

// Both token shapes the framework stamps are accepted.
request._currentAccessToken = personal
request._currentAccessToken = token
request._authenticatedUser = undefined

// @ts-expect-error a token is not a user
request._authenticatedUser = token
// @ts-expect-error a bearer string is not a token row
request._currentAccessToken = 'secret'

void [user, email, id, scopes]
