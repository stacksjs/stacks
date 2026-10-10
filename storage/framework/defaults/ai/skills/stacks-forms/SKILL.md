---
name: stacks-forms
description: Use when building persisted form definitions, conditional fields, uploads, payments, submissions, or CSV exports. Covers @stacksjs/forms and config/forms.ts.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Native forms

Use the persisted form-builder API for forms managed as data. This is distinct
from browser useForm state and validation; read stacks-composables for that.

## Definitions and submissions

createForm(siteId, input) creates or updates a form by its site-scoped handle.
Re-provisioning replaces its field document; it does not merge removed fields.
Fields declare name, label, type, required status, options, conditions and width.
loadFormByHandle and loadFormByUuid read definitions; publicDefinition removes
private settings from the public projection.

Use evaluateConditions/visibleFields and validateSubmission rather than
duplicating conditional-required logic in a route. submitForm persists the
accepted input; fetchSubmissions and exportSubmissionsCsv serve administrative
reads. Supply the site identity from trusted request context. A null site id is
the single-site/global context, not a tenant identity from a client.

## Uploads, notifications, and paid forms

Use resolveUploadLimits, checkUpload, fileFieldNamed, formUploadPrefix and
isOwnedUploadPath for the upload workflow. Do not accept an arbitrary storage
path as proof that a submitted file belongs to this form/site.
dispatchSubmissionNotifications currently sends submission email through the
configured notification/email transport; it is not a six-channel form notifier.
computeAmountCents and completeSubmissionPayment support the paid-submission
flow; verify payment through the server's provider contract, not a browser flag.

Enable/install the forms bundle and migrate its models before persistence.
Read stacks-sites, stacks-storage, stacks-payments and stacks-notifications for
their actual boundaries. Test hidden/conditional fields, upload ownership,
duplicate or invalid payments, and a different site's form identifier.

Source: core/forms/src/{create,definition,conditions,validate,submissions,uploads,
notifications}.ts. Retained tests: forms.test.ts and uploads.test.ts.
