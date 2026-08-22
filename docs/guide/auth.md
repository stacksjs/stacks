---
title: Authentication
description: "Stacks provides token authentication, passkeys, two-factor authentication, authorization gates, policies, role-based access control, email verification, an..."
---
# Authentication

Stacks provides token authentication, passkeys, two-factor authentication, authorization gates, policies, role-based access control, email verification, and password resets through `@stacksjs/auth`.

## Configure authentication

The defaults live in `config/auth.ts`. API tokens use the database-backed `users` provider and expire after 30 days unless you change `tokenExpiry`.

```ts
export default {
  default: 'api',
  guards: { api: { driver: 'token', provider: 'users' } },
  providers: { users: { driver: 'database', table: 'users' } },
  username: 'email',
  password: 'password',
  defaultAbilities: ['*'],
}
```

Keep hashing settings in `config/hashing.ts` and firewall settings in `config/security.ts`.

## Log in and inspect the current user

```ts
import { Auth } from '@stacksjs/auth'

const result = await Auth.login({
  email: 'ada@example.com',
  password: 'correct-horse-battery-staple',
})

if (!result)
  throw new Error('Invalid credentials')

const user = await Auth.user()
const isAuthenticated = await Auth.check()
```

The built-in API routes include `POST /login`, `POST /register`, `POST /auth/refresh`, `GET /auth/tokens`, `GET /me`, and `POST /logout`.

## The pages that come with it

Every app serves a working set of auth pages by default, so nothing has to be
built before someone can sign in:

| Page | What it does |
| --- | --- |
| `/login` | Sign in, plus buttons for whichever social providers `config/services.ts` has credentials for |
| `/register` | Create an account, with the same social buttons |
| `/forgot-password` | Request a reset link |
| `/password/reset/{token}` | Where that emailed link lands. Change the address with `config.auth.passwordReset.url` |
| `/auth/magic/{token}` | Where a magic link lands. It posts the token rather than consuming it on GET, because mail scanners prefetch links |

`GET /login` renders the page while `POST /login` reaches the API, because the
views server forwards every mutating verb to the router.

Each page is a thin view over a component in
`resources/components/Dashboard/Auth/`. Override any of them by creating the
same path under your own `resources/views/` - yours wins. To replace only the
markup, keep the container and pass your own component, or use the `social`
slot on the sign-in and sign-up cards to change what sits under the form.

## Protect a route

Register middleware by name instead of implementing authentication again:

```ts
route.get('/account', 'Actions/AccountAction').middleware('auth')
```

The available aliases include `auth`, `guest`, `abilities`, `role`, `permission`, `verified`, and `throttle`.

## Authorize an action

Define application abilities in `app/Gates.ts`:

```ts
import { Gate } from '@stacksjs/auth'

Gate.define('edit-settings', user => Boolean(user))
```

Then inspect or enforce the result:

```ts
const allowed = await Gate.can('edit-settings', user)
await Gate.authorize('edit-settings', user)
```

Use policies when authorization belongs to a model. Use `Rbac` when access is driven by persistent roles and permissions.

## Passkeys and two-factor authentication

Enable passkeys on the user model with `useAuth: { usePasskey: true }`. The package exports WebAuthn registration and authentication helpers plus TOTP secret, URI, token, and verification functions.

Never log tokens, passkey challenges, reset tokens, or two-factor secrets.
