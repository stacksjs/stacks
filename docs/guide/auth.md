---
title: Authentication
description: "Stacks provides token authentication, passkeys, two-factor authentication, authorization gates, policies, role-based access control, email verification, an..."
---
# Authentication

Stacks provides token authentication, passkeys, two-factor authentication, authorization gates, policies, role-based access control, email verification, and password resets through `@stacksjs/auth`.

## Configure authentication

The defaults live in `config/auth.ts`. Access tokens use the database-backed
`users` provider and expire after one hour unless you change `tokenExpiry`.
Refresh tokens default to 30 days and rotate when exchanged.

```ts
export default {
  default: 'api',
  guards: { api: { driver: 'token', provider: 'users' } },
  providers: { users: { driver: 'database', table: 'users' } },
  username: 'email',
  password: 'password',
  tokenExpiry: 60 * 60 * 1000,
  refreshTokenExpiry: 30 * 24 * 60 * 60 * 1000,
  browserSession: {
    baselineLifetime: 60 * 60 * 1000,
    rememberedLifetime: 60 * 60 * 1000,
    withRefreshToken: true,
  },
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

## Expose delegated OAuth access

Stacks can act as an opt-in OAuth authorization server for integrations that
need user-approved API access. It is disabled unless `oauthProvider.enabled`
is `true`, and an enabled provider requires an explicit issuer, scope policy,
and resource policy:

```ts
export default {
  oauthProvider: {
    enabled: true,
    issuer: env.APP_URL,
    scopes: {
      'issues:read': {
        description: 'Read issues',
        resources: ['bughq'],
      },
      'issues:write': {
        description: 'Write issues',
        resources: ['bughq'],
      },
    },
    resources: {
      bughq: { audience: 'https://api.example.com/issues' },
    },
    // Keep machine grants and resource-server introspection opt-in too.
    clientCredentials: false,
    introspection: false,
    // Recheck account status before code exchange, refresh, and introspection.
    subjectEligibility: async subject => subject.type === 'users'
      ? await accountIsAllowed(subject.id)
      : true,
  },
}
```

The initial profile is authorization code with S256 PKCE and rotating refresh
tokens. Implicit and resource-owner-password grants are not accepted. The
issuer must be canonical and HTTPS outside loopback development. Redirect URIs
are exact matches, web redirects require HTTPS, and native loopback HTTP is
the only development exception.

The default route bundle provides:

| Endpoint | Purpose |
| --- | --- |
| `GET /oauth/authorize` | Validate the client request, then show login or consent |
| `POST /oauth/authorize` | Approve or deny consent with CSRF protection |
| `POST /oauth/token` | Exchange a code or rotate a refresh token |
| `POST /oauth/revoke` | Revoke a token owned by the calling client |
| `GET /.well-known/oauth-authorization-server` | Publish RFC 8414 discovery metadata |
| `GET /auth/oauth/clients` | List the signed-in user's clients |
| `POST /auth/oauth/clients` | Register a public or confidential client |
| `PATCH /auth/oauth/clients/{id}` | Edit an owned client policy |
| `POST /auth/oauth/clients/{id}/rotate-secret` | Rotate a confidential secret |
| `POST /auth/oauth/clients/{id}/disable` | Disable a client and revoke its credentials |
| `GET /auth/oauth/connections` | List connected applications |
| `POST /auth/oauth/connections/{id}/disconnect` | Revoke a connected application |

The browser flow is: generate a verifier and state, send the public client's
exact redirect URI and S256 challenge to `/oauth/authorize`, verify `state` on
the callback, and exchange the one-time code at `/oauth/token`. A confidential
client authenticates with HTTP Basic. A public client proves possession of the
verifier instead. Request only the scopes and resources the integration needs.

Access and refresh tokens, authorization codes, browser request handles, and
confidential secrets are stored as hashes. Plaintext confidential secrets are
returned only at registration or rotation. Token responses use `no-store` and
`no-cache` headers. Client disablement, disconnect, password reset, and logout-all
revoke the associated delegated credentials according to their owner and grant
boundaries. Resource servers may opt into protected `POST /oauth/introspect`
when they need authoritative status for opaque tokens.

Use `subjectEligibility` when an application has account states that the
framework cannot infer from the existence of a row, such as disabled or
suspended users. The callback receives the subject, client, grant, and
workspace binding. Returning `false` rejects authorization-code and refresh
exchanges, revokes the affected grant, and makes introspection return
`{ active: false }`. Service subjects must be handled explicitly by the
application callback.

Client credentials are a separate opt-in for confidential service clients. Set
`clientCredentials: true`, register a confidential client with the
`client_credentials` grant, and authenticate with its rotated secret. These
tokens have no refresh token and do not represent a logged-in end user. OpenID
Connect, implicit grants, dynamic registration, and device authorization are
not part of this profile.

## Configure browser sessions

`browserSession` controls credentials issued by the default `/login`,
`/register`, and `/verify-two-factor-login` actions. Dedicated personal access
token and OAuth issuance keep using their existing token settings. Every
lifetime in this block is an absolute duration in milliseconds. `idleTimeout`,
when set, is a separate limit on how long a live session may go unused.

This example gives ordinary browser sessions seven days, remembered sessions
30 days, and does not mint a refresh credential the browser will never use:

```ts
const day = 24 * 60 * 60 * 1000

export default {
  browserSession: {
    baselineLifetime: 7 * day,
    rememberedLifetime: 30 * day,
    withRefreshToken: false,
    logoutRedirect: '/login?logged_out=1',
  },
}
```

The default login form sends its checkbox as `remember`. Registration uses the
baseline tier unless a custom client submits `remember`. When two-factor
authentication is enabled, `/login` returns a single-use challenge instead of
a session. The selected tier is stored with that challenge and applied only
after `POST /verify-two-factor-login` succeeds. Failed, expired, and replayed
challenges do not issue a cookie or token.

The framework serializes the issued access token into an HttpOnly cookie whose
Max-Age matches the token's actual lifetime. Server-rendered requests therefore
authenticate after login, registration, or completed two-factor verification
without copying the token into JavaScript storage. Cookie-authenticated writes
still require the normal CSRF token. SameSite is an additional browser defense,
not a replacement for CSRF validation.

`POST /logout` revokes the server credential before clearing the cookie. JSON
clients keep receiving JSON. An HTML form receives the configured local
`logoutRedirect`; external and protocol-relative destinations are rejected.
Configure `config.auth.cookie` to set the cookie name, path, domain, SameSite,
or an explicit Secure override. Issuance and logout use the same configured
identity attributes, so clearing removes the cookie the browser received.
Without overrides it uses Path `/`, SameSite `Lax`, an app-URL-derived Secure
flag, and unconditional HttpOnly. Framework browser sessions always override a
configured `maxAge` with the lifetime of the token that was actually issued.

After upgrading an app that copied the default login, registration, two-factor,
logout actions, or cookie serializer, remove only those framework-equivalent
overrides. Keep application hooks such as onboarding, team creation, mailing
list subscriptions, and notifications in app events or app-owned actions.

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
