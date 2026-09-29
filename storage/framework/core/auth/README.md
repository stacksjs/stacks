# Stacks Auth

wip

## ☘️ Features

wip

- ⚡️

wip

## 🤖 Usage

wip

```bash
bun install -d @stacksjs/auth
```

Now, you can use it in your project:

```js
import auth from '@stacksjs/auth'

// wip
```

Learn more in the docs.

## OAuth authorization provider

The authorization provider is disabled by default under `oauthProvider` in
`config/auth.ts`. Enabling it requires a canonical issuer plus explicit scope
and resource policy:

```ts
oauthProvider: {
  enabled: true,
  issuer: env.APP_URL,
  scopes: {
    'issues:read': { description: 'Read issues', resources: ['bughq'] },
  },
  resources: {
    bughq: { audience: 'https://api.example.com/issues' },
  },
}
```

The default auth route bundle then serves:

- `GET` and `POST /oauth/authorize` for login, consent, denial, and S256 PKCE
- `POST /oauth/token` for authorization-code exchange and rotating refresh tokens
- `POST /oauth/revoke` for client-owned access and refresh token revocation
- `GET /.well-known/oauth-authorization-server` for RFC 8414 metadata
- authenticated client registration, editing, secret rotation, and disable routes under `/auth/oauth/clients`
- authenticated connected-application listing and disconnect routes under `/auth/oauth/connections`

The implementation stores only hashes for codes, access tokens, refresh
tokens, browser authorization state, and confidential client secrets. Client
redirects use exact matching. Consent and issued credentials remain bound to
the client, subject, scopes, resources, audiences, and optional workspace.

This profile does not implement client credentials, token introspection, or
OpenID Connect. Do not configure or advertise those capabilities until their
authentication and authorization policies are implemented.

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
