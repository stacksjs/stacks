# Stacks Analytics

This package integrates analytics features into your application.

## ☘️ Features

- [ ] Stacks Dashboard integration

## 🤖 Usage

```bash
bun install -d @stacksjs/analytics
```

Render the driver selected in `config/analytics.ts`:

```ts
import { generateAnalyticsScript } from '@stacksjs/analytics'
import { analytics } from '@stacksjs/config'

const head = generateAnalyticsScript(analytics)
```

AnalyticsHQ is the default driver. It emits no tags until
`drivers.analyticshq.siteId` is set, so a new application never sends a broken
or unidentified event. Name another driver explicitly to use it instead.

Remote analytics can be limited to explicit application environments:

```ts
import type { AnalyticsConfig } from '@stacksjs/types'

export default {
  driver: 'analyticshq',
  environments: ['production', 'staging'],
  drivers: {
    analyticshq: { siteId: 'YOUR_APP_ID' },
  },
} satisfies AnalyticsConfig
```

Stacks resolves `APP_ENV` before selecting or initializing the driver. An
excluded environment emits no tracking tag. `enabled: false` always wins, an
empty allowlist disables every environment, and local environments can opt in
by naming their exact label. Leaving `environments` unset preserves existing
application behavior.

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
