# Stacks Alias

The Stacks aliases.

## Workspace source resolution

The five source TypeScript configs use generated mappings from actual package
manifest names and public exports. A directory named `desktop` belongs to
`@stacksjs/desktop-build`; the external `@stacksjs/desktop` package resolves
normally through its installed exports. Namespace catchalls cannot preserve
that boundary.

`workspacePackages(core)` discovers unique manifest identities.
`workspaceSourceAliases(core)` maps their declared runtime exports to source,
and maps the umbrella's own exports to the corresponding child entrypoints.
The defaults package's publish wrapper maps to the canonical scaffold tree.
The helpers reject duplicate identities and missing source entries instead of
consulting stale `dist` output. `workspaceSourcePaths(core, configDirectory)`
returns the relative path form consumed by TypeScript and Bun.

After changing a workspace manifest or its public exports, run from the root:

```bash
bun .github/scripts/generate-workspace-aliases.ts
bun .github/scripts/generate-workspace-aliases.ts --check
```

The generator validates all five configs before writing any. The alias test
suite runs its freshness check in CI. Application/resource aliases remain in
each config. Package-based app templates keep their separate installed-package
resolution config.

## ☘️ Features

- 🤷🏼‍♂️ git Diff Interpreter

## 🤖 Usage

```bash
bun install -d @stacksjs/alias
```

You may now use:

```ts
import { alias } from '@stacksjs/alias'

console.log(alias)
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
