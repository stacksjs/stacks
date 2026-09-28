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

The authorization provider is opt-in through `config/auth.ts`. Enabling it
requires an explicit issuer, registered scopes and resources, and a reviewed
client policy. Provider routes remain unavailable until the complete consent
and token-exchange flow is registered.

The framework currently exports protocol primitives for incremental provider
integration:

- `resolveOAuthProviderConfig()` validates and snapshots provider policy.
- `validateOAuthClientRegistration()` validates client-controlled metadata.
- `validateOAuthAuthorizationRequest()` validates exact redirects, scopes,
  resources, and S256 PKCE before login or consent.
- `issueAuthorizationCode()` and `withAuthorizationCode()` provide hash-only,
  short-lived, atomic, single-use authorization codes.

These primitives do not turn personal access tokens into delegated OAuth
tokens, and they do not register public endpoints by themselves.

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
