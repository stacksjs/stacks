# Stacks Socials

A simple and elegant social authentication package for Stacks, inspired by Laravel's Socialite.

## ☘️ Features

- 🔑 Easy OAuth Authentication
- 🔌 Support for Multiple Providers (GitHub, Google, Facebook, etc.)
- ⚡️ Simple & Intuitive API
- 🛠️ Customizable Provider Configuration
- 🔒 Secure Token Handling
- 🎯 TypeScript Support

## 🤖 Usage

```bash
bun install -d @stacksjs/socials
```

Now, you can use it in your project:

```js
import { Socials } from '@stacksjs/socials'

// Configure your social provider
const github = Socials.driver('github')

// Redirect to provider
const authUrl = await github.redirect()

// Handle callback
const user = await github.user()
```

### Validate the OAuth `state`

Do not hand-roll this. The driver already ships a constant-time check, and an
HMAC written next to it is a CSRF hole waiting to be got subtly wrong:

```ts
import { Socials } from '@stacksjs/socials'

// On the redirect: mint a state, stash it, embed it.
const state = crypto.randomUUID()
const github = Socials.driver('github').withState(state)
// persist `state` in the session/cookie, then redirect to:
const authUrl = await github.redirect()

// On the callback: compare what came back against what you stashed.
if (!github.validateState(stashedState, url.searchParams.get('state')))
  throw new HttpError(400, 'Invalid OAuth state')
```

`validateState()` is timing-safe, so response time cannot leak a prefix match.
Without `withState()` the driver mints a state you cannot recover, and there is
nothing to compare against on the way back.

### Sign the browser in

The provider hands you a user; `@stacksjs/auth` turns that into a session. Set
the auth cookie and redirect — no HTML, no inline script, and nothing secret in
the URL:

```ts
import { Auth, authCookie } from '@stacksjs/auth'

const session = await Auth.loginUsingId(localUser.id)

return new Response(null, {
  status: 303,
  headers: {
    'Location': '/account',
    'Set-Cookie': authCookie(String(session.token)),
  },
})
```

`authCookie()` writes an `HttpOnly`, `SameSite=Lax`, `Secure`-outside-local
cookie under the same name every framework reader looks for, so the next
request is authenticated by the Auth middleware with nothing further to do.

On the page you land on, hydrate the client session:

```ts
const { completeSocialLogin } = useAuth()
const user = await completeSocialLogin()
```

Do NOT write `token` / `refresh_token` / `user` into `localStorage` yourself.
Those keys are `useStorage`-encoded (JSON-stringified on write), and
re-deriving that encoding by hand is how you end up storing the string
`[object Object]` for a user (stacksjs/stacks#2236).

Learn more in the docs.

## 🧪 Testing

```bash
bun test
```

## 📈 Changelog

Please see our [releases](https://github.com/stacksjs/stacks/releases) page for more information on what has changed recently.

## Completing a sign-in

The driver stops at the provider user. These two steps take it the rest of the
way, and both already exist — do not hand-roll either.

### CSRF state

`withState()` / `getState()` / `validateState()` ship on the abstract driver
(`src/abstract.ts`). `validateState()` compares in constant time. There is no
reason to write your own HMAC.

```ts
const url = driver.withState(await driver.redirectUrl())
// …provider redirects back…
if (!driver.validateState(request.get('state')))
  return socialHandoffFailureRedirect('invalid_state', { redirectTo: '/login' })
```

### Handing the session to the browser

Do **not** return an HTML page whose inline script writes `localStorage`. The
session format is the framework's, and re-deriving it is how apps ended up
double-stringifying tokens and storing the literal `[object Object]` as the
user (stacksjs/stacks#2236). An inline script also has to escape provider text
— a display name containing a closing script tag terminates the block.

```ts
import { socialHandoffRedirect } from '@stacksjs/socials'

const result = await Auth.loginUsingId(user.id)

return socialHandoffRedirect({
  token: result.token,
  refreshToken: result.refreshToken,
  user: { id: user.id, email: user.email, name: user.name },
  expiresIn: result.expiresIn,
}, { redirectTo: '/account' })
```

That is a plain 302 — no HTML, no script, nothing to escape. The pack travels
in the URL fragment, which is never sent to a server, so it stays out of access
logs, `Referer` and any proxy in between.

On the landing page:

```ts
const { completeSocialLogin } = useAuth()

// Safe on every load: resolves null when there was no handoff to apply.
const user = await completeSocialLogin()
```

That writes through the same storage refs an ordinary `login()` uses, so the
encoding cannot be got wrong, and strips the fragment from the URL and from
history. It then confirms the session against `/api/me`, which is also what
picks up the cookie handoff below — there the browser holds no tokens at all
and there is nothing in the fragment to apply.

An absolute `redirectTo` is refused unless its host is in `allowedHosts` — the
redirect carries a token pack, and the target often comes from user input.

## 🚜 Contributing

Please review the [Contributing Guide](https://github.com/stacksjs/contributing) for details.

## 🏝 Community

For help, discussion about best practices, or any other conversation that would benefit from being searchable:

[Discussions on GitHub](https://github.com/stacksjs/stacks/discussions)

For casual chit-chat with others using this package:

[Join the Stacks Discord Server](https://stacksjs.com/discord)

## 📄 License

The MIT License (MIT). Please see [LICENSE](https://github.com/stacksjs/stacks/tree/main/LICENSE.md) for more information.

Made with 💙
