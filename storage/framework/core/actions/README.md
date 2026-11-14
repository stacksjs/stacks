# Stacks Actions

This package contains the Stacks Actions.

## ☘️ Features

- Generate Component Meta information
- Generate IDE Helper files
- Generate Stacks Library Entry Points
- Generate Package Manifests
- Generate VS Code Custom Data file
- Generate STX component metadata

## 🤖 Usage

```bash
bun install -d @stacksjs/actions
```

Now, you can use it in your project:

```ts
import actions from '@stacksjs/actions'

// wip
```

Learn more in the docs.

## API server listeners

Set `PORT_API=0` when a test or supervising tool needs an available port. The
operating system assigns it while starting the listener; the ready banner
prints that actual address. An omitted or empty value uses `config.ports.api`,
then port 3008. Invalid port values fail before startup.
Configuration validation accepts zero for the API listener; other services
continue to require a fixed port from 1 through 65535.

When the API entry is spawned with Bun IPC, it sends
`{ type: 'stacks:api-ready', port: number, url: string }` after routes load and
the server is listening. Use this address to configure a fixture proxy or make
requests, without probing and releasing a port before the child starts.

## Retained library release artifacts

The narrow `@stacksjs/actions/library/release-artifacts` entrypoint supplies
`prepareLibraryRelease`, `inspectLibraryRelease`, `materializeLibraryRelease`
and `retainLibraryRelease`. Preparation uses the existing native resolver and
builder, runs declared project checks, then packs each public package once with
Bun. No configured packages, unmatched sample defaults, private-only packages
and `releaseable: false` are no-ops on this release path. Explicit library
build/publication keeps its existing strict behavior.

A version 1 `candidate.json` records repository/full source SHA, optional source
tag, Bun/packer versions and the installed stx compiler version when used, independent package versions, registry/access/tag,
original `.tgz` SHA-256/SHA-512 SRI and per-file identities, named check receipts,
and optional hosted files. Hosted retention consumes the native builder report
directly; compiler bundle/CSS/manifest files must equal the package's bytes.
Candidate directories are created exclusively and their record is written last.
Inspection validates bounded archives, paths, exports, manifests and every
retained identity without rebuilding or executing historical source. Restore
uses an exclusively created clean destination and writes regular files only.

`@stacksjs/actions/library/release-registry` supplies
`publishPreparedLibraryRelease` and `readbackLibraryRelease`. Publication names
the retained archive in publisher argv and disables lifecycle scripts. Default
npm discovery chooses installed Bun, then npm; explicit publisher selection
never falls back. Existing versions are skipped only after comparing actual
registry archive bytes and the requested tag. Different bytes are terminal;
there is no overwrite or automatic tag mutation. Receipts retain actual tags,
source SHA and, for historical readback, a separate current verifier SHA.

Readback shares one monotonic deadline across metadata, archive and tag reads,
with individual request/body budgets. Network errors, 429, 5xx and post-upload
propagation 404 are retry eligible. Authorization, schema, integrity and tag
mismatches fail immediately. Redirects and tarballs outside the actual registry
origin are refused. The npm adapter defaults to `registry.npmjs.org`; an explicit
private HTTPS origin is used consistently for publication and readback.

Bun 1.4.4 documents pre-existing `.tgz` publication and is exercised against an
owned local npm fixture that compares uploaded attachment bytes. npm accepts a
package archive as its package spec and is tested by the same local upload fixture
when installed. Pantry 0.11.206 documents directory/glob
publication only: exact retained-archive publication and Pantry-registry readback
are explicitly unsupported here. Legacy directory-based `libs:publish`
discovery and behavior remain unchanged.

`@stacksjs/actions/library/release-source` accepts exact CI repository/SHA/run,
workflow, branch, required jobs and one nonexpired, bounded artifact owned by
that run. It rejects forks, duplicate/missing jobs and artifacts, and supplies a
safe derived download URL. The shared CI evaluator preserves the framework's
existing job selection and never-started-job retry policy; callers provide their
own workflow/job names. Ownership receipts are data, never historical code.

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
