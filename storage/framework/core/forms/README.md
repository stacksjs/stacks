# @stacksjs/forms

Native form definitions, conditional fields, validation, submissions, and
notification helpers for Stacks applications.

## Configuration

Forms are an optional framework feature. Enable the bundle with:

```bash
./buddy forms:install
```

This enables `config/forms.ts` and the model-generated migrations for forms,
fields, and submissions. Disable it with `./buddy forms:uninstall`.

## Runtime API

The package exposes typed helpers for:

- defining and validating form schemas
- evaluating conditional field visibility
- normalizing and storing submissions
- delivering submission notifications

Application-specific form models and actions remain under `app/`. Reusable
form behavior belongs in this package.

Form UUID lookups require an exact site identity. A null site selects only global forms; an unresolved host in multi-site mode cannot read, upload to, or submit any form.

`createForm` replaces the definition and its fields atomically, with retries for concurrent provisioning. SQLite acquires its writer lock before reading. PostgreSQL uses serializable isolation and requires the same isolation in an enclosing transaction. MySQL uses a connection-owned site lock and a locking current read; call it outside an enclosing MySQL transaction so the lock handoff completes with the row commit. These paths also serialize the global/null-site identity, which ordinary SQL composite unique indexes do not enforce.

Conditional visibility resolves controller dependencies before using their values. Hidden and unknown values cannot control other fields; cyclic rules and reserved field names reject submissions. The browser and server use the same visibility helper.

Currency inputs are nonnegative safe integer cents, or decimal digit strings. Payment sources must be currency fields, and configured amounts and computed totals must remain safe integers. Date fields require real `YYYY-MM-DD` calendar dates. Disjoint field/application upload allowlists reject all uploads.

CSV exports paginate by submission ID and include the full result set without a fixed row cap. New submissions arriving after the first page are excluded from that export.
