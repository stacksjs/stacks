---
title: How to build a component library
description: Build reusable STX components and standards-based custom elements.
---
# How to build a component library

Create `.stx` components in `resources/components/` and declare the public custom-element tags in `config/library.ts`.

```bash
./buddy dev:components
./buddy build:components
```

The build creates the STX component package and Web Component output from the same source. Keep props typed, emit documented events, and use slots for caller-owned content.

See [Component libraries](/guide/libraries/components) for configuration and packaging examples.
