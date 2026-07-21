---
title: Testing Applications
description: Run unit, feature, browser, type, and database tests with Buddy and Bun.
---
# Testing

Run the complete test suite with Buddy:

```bash
./buddy test
```

Use focused commands while iterating:

```bash
./buddy test:unit
./buddy test:feature
./buddy test:ui
./buddy test:types
```

Tests live under `tests/` and use Bun's test runner. Keep database tests isolated, create data through factories, and assert observable behavior instead of internal implementation details.

See [Testing](/guide/testing) for setup and suite organization.
