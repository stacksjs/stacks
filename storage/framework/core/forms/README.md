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
