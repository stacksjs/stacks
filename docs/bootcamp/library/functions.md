---
title: How to build a function library
description: Export typed functions from a Stacks project as a reusable package.
---
# How to build a function library

Place reusable TypeScript functions in `resources/functions/` and list the public entries in `config/library.ts`.

```ts
functions: {
  name: 'acme-functions',
  files: ['format-price', 'normalize-order'],
}
```

Build the package and inspect its generated output before publishing:

```bash
./buddy build:functions
./buddy test:types
```

Keep exported functions independent of application-only globals. Explicit inputs and return types make the package usable in browser, server, and worker runtimes.
