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
