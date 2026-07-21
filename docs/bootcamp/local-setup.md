---
title: Local Setup
description: Install Pantry, create a Stacks project, and verify the local development environment.
---
# Local Setup

Stacks uses Pantry to provision Bun 1.3 or newer and the rest of its toolchain. Install Pantry, run `pantry bootstrap` once, then create a project with Buddy and verify it before starting development.

```bash
panx @stacksjs/buddy new my-app
cd my-app
./buddy doctor
./buddy dev
```

Buddy uses rpx and tlsx to serve the configured `APP_URL` over local HTTPS. The default project URL is a readable `.localhost` domain, and the direct localhost ports remain available for diagnostics.

See [IDE setup](/bootcamp/how-to/ide-setup) for editor configuration and [Getting Started](/guide/get-started) for the application walkthrough.
