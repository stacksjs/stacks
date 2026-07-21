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
