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

::: warning These delete the scaffolding they installed
`<feature>:uninstall` does two things: it flips the feature off in `config/`,
and it **deletes the paths in that feature's manifest**. For commerce that is
`app/Models/commerce/`, `app/Actions/Commerce/`,
`app/Actions/Dashboard/Commerce/`, `resources/components/Dashboard/Commerce/`
and `resources/views/dashboard/commerce/`.

Files you have edited are kept. The command compares each one against the
template it was stamped from and removes only what is still unchanged, listing
anything it kept so you can see what survived. A file you added inside one of
those directories is kept too, since it matches no template.

Two flags change that:

```bash
./buddy commerce:uninstall --keep-files   # disable the feature, delete nothing
./buddy commerce:uninstall --force        # delete your edits as well
```

The feature is disabled in every case. A file edited and then changed back to
match the template reads as untouched and is removed, so commit before a large
uninstall if that distinction matters to you.
:::

Run `./buddy doctor` afterward to find configuration or stamped files left by a disabled feature. Do not delete `storage/framework` from an active application because it contains the framework runtime.
