# @stacksjs/features

Which files and tables belong to which optional Stacks feature.

Two very different callers need this manifest and neither should own it. The
CLI installs and uninstalls a feature, so it needs the file list.
The migration runner hides a disabled feature's migrations before a run, so it
needs the table list.

The manifest used to live in `@stacksjs/buddy`, and the migration runner
reached into the CLI through a best-effort dynamic import to read it — so
`@stacksjs/database` depended on `@stacksjs/buddy`, and the two sat inside a
dependency cycle that no publish order could satisfy.

```ts
import { FEATURE_NAMES, migrationFeature, migrationTable } from '@stacksjs/features'

migrationTable('0000000133-create-campaigns-table.sql') // 'campaigns'
migrationFeature('0000000133-create-campaigns-table.sql') // 'marketing'
```

Nothing here reads config or touches a database — it is the manifest and three
lookups over it. Deciding whether a feature is *enabled* is `@stacksjs/config`'s
job, and acting on that is the caller's.
