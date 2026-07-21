---
title: Publishing Libraries
description: "Build, verify, version, and publish a Stacks library through npm trusted publishing."
---

# Publishing libraries

Stacks libraries publish compiled JavaScript and declarations, not source-only framework internals. Keep the package dependency surface explicit and verify the packed artifact before tagging a release.

## Package contract

```json
{
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "files": ["dist", "README.md", "LICENSE.md"],
  "scripts": {
    "build": "bun --bun build.ts",
    "prepublishOnly": "bun run build",
    "release:patch": "bunx --bun bumpx patch --commit --tag --push --yes"
  },
  "publishConfig": {
    "access": "public",
    "provenance": true
  }
}
```

STX component packages should depend on `@stacksjs/stx`, use `.stx` source files, and import testing helpers from `@stacksjs/stx/testing`.

## Verify locally

```bash
bun install --frozen-lockfile
bun run lint
bun run test:types
bun test
bun run build
bun pm pack --dry-run
```

Inspect the dry-run file list and confirm that every exported JavaScript and declaration file is included.

## Trusted publishing

Configure the package on npm with its GitHub repository and release workflow. The workflow needs `id-token: write` so npm can verify the GitHub Actions identity without a long-lived publish token.

```yaml
jobs:
  npm:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      id-token: write
```

The package, repository, owner, and workflow filename must exactly match the trusted publisher configuration on npm.

## Release

Use a conventional commit for the implementation, then run the requested release bump:

```bash
bun run release:patch
```

The tag-triggered workflow builds, publishes with provenance, and creates the GitHub release. Verify the npm version and GitHub Actions run before considering the release complete.

## Related guides

- [Getting started with libraries](/guide/libraries/get-started)
- [Component libraries](/guide/libraries/components)
- [Function libraries](/guide/libraries/functions)
