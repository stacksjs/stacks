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

::: warning These delete files, including ones you changed
`<feature>:uninstall` does two things: it flips the feature off in `config/`,
and it **deletes every path in that feature's manifest**, recursively, with no
prompt. For commerce that is `app/Models/commerce/`, `app/Actions/Commerce/`,
`app/Actions/Dashboard/Commerce/`, `resources/components/Dashboard/Commerce/`
and `resources/views/dashboard/commerce/`.

Edits you made inside those paths go with them. Install is careful here and
skips a file that already exists rather than overwriting your version; uninstall
does not make the same check.

To turn a feature off and keep the scaffolding:

```bash
./buddy commerce:uninstall --keep-files
```

The feature is disabled either way. `--keep-files` only decides whether the
files survive, so reach for it whenever you have touched anything in those
directories, or commit first so the deletion is recoverable.
:::

Run `./buddy doctor` afterward to find configuration or stamped files left by a disabled feature. Do not delete `storage/framework` from an active application because it contains the framework runtime.
