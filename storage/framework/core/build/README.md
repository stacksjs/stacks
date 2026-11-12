# Stacks Build

Shared Bun package build tooling, declaration validation and runtime export checks.

## Workspace builds

`buildWorkspacePackages(directories)` reads package names and runtime dependencies
from the selected manifests and builds providers before their consumers. Each
package runs once through its normal build script and keeps its declaration and
runtime export checks. Failed dependencies block their consumers; independent
packages still build and report failures. Cycles and duplicate package names fail
before any build starts.

`dependencyLayers(packages)` supplies the same stable ordering to framework
publication. Dependencies outside the selected set are resolved normally. Peer
dependencies describe host integrations and do not order builds. A peer used by
public declarations must remain required and pass the installed SDK checks;
type-only integrations can refer back to their host without a runtime build cycle.

`buddy build:core` preserves the application's feature selection. The release
workflow uses `.github/scripts/build-framework.ts` to select every buildable
public framework package, including the umbrella, regardless of app features.

## ☘️ Features

wip

- ⚡️

wip

## 🤖 Usage

wip

```bash
bun install -d @stacksjs/actions
```

Now, you can use it in your project:

```js
import * as build from '@stacksjs/build'

// wip
```

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
