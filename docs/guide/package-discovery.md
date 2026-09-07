# Package Discovery

A package can bring its own routes, views, models and migrations into an
application, the way a Laravel package does. Install it and its pieces are
found:

```bash
bun add loghq
```

No registration step, no copying files by hand. Discovery scans for installed
packages that declare a `stacks` key, records where each one lives, and the
framework's own loaders read that record.

## Declaring a package

A package opts in by adding a `stacks` key to its `package.json`:

```json
{
  "name": "loghq",
  "version": "1.0.0",
  "stacks": {
    "routes": ["routes/api.ts"],
    "views": ["resources/views"],
    "migrations": ["database/migrations"],
    "routePrefix": "loghq",
    "routeMiddleware": ["auth"]
  }
}
```

Every path is relative to the package's own root. A path that escapes it, by a
leading slash or a `..` segment, is ignored: a package registering a directory
outside itself would serve files the application never installed.

## What each field does

These are the fields the framework reads today.

| Field | Type | What it does |
|---|---|---|
| `routes` | `string[]` | Route files to register. Resolved against the package root. |
| `routePrefix` | `string` | Prefix applied to every route the package registers. |
| `routeMiddleware` | `string \| string[]` | Middleware applied to every one of those routes. |
| `views` | `string \| string[]` | Template directories. Appended after the application's own, so nothing that already resolves changes. |
| `migrations` | `string \| string[]` | SQL migration directories. Defaults to `database/migrations`. |
| `name` | `string` | Stack extension name, for a package that provides whole top-level directories. |
| `description` | `string` | Stack extension description. |
| `directories` | `string[]` | Which top-level directories a stack extension provides. |

**Models have no field.** A package that ships `app/Models` is found without
declaring anything, because that is where every Stacks application puts them.

`views` and `migrations` have defaults too, so a package that only ships views,
migrations and models needs no more than `"stacks": {}`. Declaring them
explicitly is for a package that ships more than one subtree, or uses different
paths.

`routes` has no default and must be listed. There is no conventional location
to fall back to, and registering every `.ts` file under a package's `routes/`
directory would register whatever a package happened to leave there.

### Declared but not yet read

`PackageStacksMeta` also accepts `providers`, `components`, `commands` and
`middleware`. Nothing consumes them yet. They are reserved rather than
functional, and a package that sets one today gets no behaviour from it.

## The manifest

Discovery writes `storage/framework/discovered-packages.json`:

```json
{
  "generated_at": "2026-09-07T11:26:15.000Z",
  "packages": {
    "loghq": {
      "root": "node_modules/loghq",
      "routes": ["routes/api.ts"],
      "views": ["resources/views"],
      "migrations": ["database/migrations"]
    }
  }
}
```

`root` is written by discovery, not by the package, and is relative to the
project. Consumers resolve a package's files against it rather than assuming a
location. It is relative so the file carries no machine-specific path.

The manifest is rewritten **only when the discovered set actually changes**.
`generated_at` moves on every run, so comparing whole manifests would dirty the
file on every boot. Two things depend on that: the file stays clean in version
control, and its mtime means "when the package set last moved", which is what
the auto-import staleness check reads to decide whether a newly installed
package's models need to reach the barrel.

### Shadowing

`node_modules` is scanned before the pantry tree, so a package the application
actually depends on wins over a copy sitting in `pantry/`. When both exist, the
manifest records which copy was ignored:

```json
{
  "shadowed": [
    { "name": "loghq", "used": "node_modules/loghq", "ignored": "pantry/loghq" }
  ]
}
```

### Opting a package out

An application can refuse a package it has installed:

```json
{
  "stacks": {
    "dont-discover": ["loghq"]
  }
}
```

## Migrations

A package's migrations are copied into the application's corpus before they
run, not executed from `node_modules`. The runner treats its corpus as
writable: SQLite preprocessing deletes duplicate `CREATE TABLE` statements and
drops statements the dialect cannot execute. Running a package's directory in
place would mean the framework deleting files inside an installed package,
which the next install restores and the one after deletes again.

Staged files are named so they always run after the application's:

```
0000000133-add-orthomosaic.sql             the application, always first
9000000000-bughq__0000000001-issues.sql    then by package name
9000000000-loghq__0000000001-create.sql    then the package's own order
9000000000-loghq__0000000002-alter.sql
```

The ordinal `9000000000` is a reserved band. It matters because a package's
tables carry foreign keys into the application's (`user_id`, `team_id`) and
never the reverse: the application predates whatever it installed. A
`REFERENCES "users"` on a table created before `users` fails on Postgres and
MySQL while SQLite tolerates it, so getting this order wrong is green locally
and red on deploy.

Every package migration shares that same ordinal, and the package name and the
file's original name break the tie. That keeps a staged name stable no matter
what else is installed. The migration ledger keys on the bare filename, so a
name that shifted when another package was installed would read as new and run
a second time against tables it had already created.

A package's own ordinal is kept rather than stripped, because `create-` before
`alter-` is not something alphabetical order preserves.

### Changing a shipped migration

A changed file is republished, so a fresh database builds what the installed
version describes. It does **not** re-run on a database that already has it,
because the ledger holds that filename. A package that needs to change a table
it has already created ships another migration, exactly as an application does.
