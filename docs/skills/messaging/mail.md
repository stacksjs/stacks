---
title: "Mail skill"
description: "Use when creating mail classes in app/Mail/."
---
# Mail

`stacks-mail` · Messaging · model-invoked

Writing the mail classes in `app/Mail/`: the content, the stx or HTML template,
and variable interpolation. The framework underneath is
[Email](/skills/messaging/email).

## When to reach for it

- Defining email content and templates
- Using the template() function with STX
- HTML templates
- Variable interpolation
- Email layouts
- The app-level mail sending pattern

## Inside the skill

The sections an agent reads once the skill loads.

- Key Paths
- Creating a Mail Class
- Template Rendering
- Example: Subscription Confirmation
- Using Mail in Actions/Events
- Template Locations
- Gotchas

## Where the code lives

- Application mail: `app/Mail/`
- Email templates: `resources/emails/` (or `storage/framework/defaults/resources/emails/`)
- Email layouts: `storage/framework/defaults/resources/emails/layouts/`

## Related skills

- [Email](/skills/messaging/email)

## Using it

This one is **model-invoked**. Your agent reaches for it on its own when the task
matches, and you can also call it by name:

```
/stacks-mail
```

Source: [`stacks-mail/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-mail/SKILL.md).
Shadow it for one project with `app/Skills/stacks-mail/SKILL.md`, then re-run
`buddy setup:ai`. See [Writing your own](/skills/writing).
