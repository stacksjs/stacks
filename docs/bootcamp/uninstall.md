---
title: How to uninstall
description: Remove a Stacks project, optional feature bundle, or installed stack safely.
---
# How to uninstall

A Stacks application is self-contained. To remove an application, stop its development processes, preserve any data you need, and remove its project directory with your operating system's trash command.

Feature bundles and reusable stacks have dedicated commands:

```bash
./buddy commerce:uninstall
./buddy cms:uninstall
./buddy stack:uninstall blog
```

Run `./buddy doctor` afterward to find configuration or stamped files left by a disabled feature. Do not delete `storage/framework` from an active application because it contains the framework runtime.
