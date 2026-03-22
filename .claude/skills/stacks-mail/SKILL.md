---
name: stacks-mail
description: Use when creating mail classes in app/Mail/ — defining email content and templates, using the template() function with STX or HTML templates, variable interpolation, email layouts, or the app-level mail sending pattern. For the email framework itself (drivers, Mail singleton, EmailSDK, inbox management), see stacks-email.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Mail Classes

Application-level email definitions in `app/Mail/`.

## Key Paths
- Application mail: `app/Mail/`
- Email templates: `resources/emails/` (or `storage/framework/defaults/resources/emails/`)
- Email layouts: `storage/framework/defaults/layouts/emails/`

## Creating a Mail Class

```typescript
// app/Mail/WelcomeEmail.ts
import { mail, template } from '@stacksjs/email'
import { config } from '@stacksjs/config'

interface WelcomeEmailOptions {
  to: string
  name: string
}

export async function sendWelcomeEmail({ to, name }: WelcomeEmailOptions) {
  const { html, text } = await template('welcome', {
    variables: { name, appName: config.app.name },
    layout: 'default'
  })

  await mail.send({
    from: { name: config.app.name, address: config.email.from.address },
    to,
    subject: `Welcome to ${config.app.name}!`,
    html,
    text
  })
}
```

## Template Rendering

```typescript
import { template, renderHtml, templateExists, listTemplates } from '@stacksjs/email'

// From template file (welcome.stx or welcome.html)
const { html, text } = await template('welcome', {
  variables: { name: 'John', url: 'https://app.com/verify' },
  layout: 'default',     // wrap in layout (or false to skip)
  subject: 'Welcome'
})

// From raw HTML
const { html, text } = renderHtml('<h1>Hello {{ name }}</h1>', { name: 'John' })

// Check templates
templateExists('welcome')   // boolean
listTemplates()              // string[]
```

Variable syntax: `{{ variableName }}` (double braces with spaces).

## Example: Subscription Confirmation

```typescript
// app/Mail/SubscriptionConfirmation.ts
import { mail, template } from '@stacksjs/email'
import { url } from '@stacksjs/router'
import { config } from '@stacksjs/config'

export async function sendSubscriptionConfirmation({ to, subscriberUuid }: Options) {
  const { html, text } = await template('subscription-confirmation', {
    variables: {
      unsubscribeUrl: url('email.unsubscribe', { token: subscriberUuid }),
      appName: config.app.name
    }
  })

  await mail.send({
    from: { name: config.app.name, address: config.email.from.address },
    to,
    subject: 'Confirm your subscription',
    html,
    text
  })
}
```

## Using Mail in Actions/Events

```typescript
// In an action
import { sendWelcomeEmail } from '../../app/Mail/WelcomeEmail'

export default {
  name: 'SendWelcomeEmail',
  async handle(event: { email: string, name: string }) {
    await sendWelcomeEmail({ to: event.email, name: event.name })
    return { success: true }
  }
}
```

## Template Locations
- STX templates: `.stx` files processed by STX engine
- HTML templates: `.html` files with `{{ }}` variable interpolation
- Layouts: base HTML wrapping templates (header, footer, styles)

## Gotchas
- Mail classes are plain functions, not classes — no inheritance needed
- Templates support both `.stx` (reactive) and `.html` (static) formats
- Variable interpolation uses `{{ }}` — not `${}`
- `text` output is auto-generated from HTML via `htmlToText()`
- Layouts wrap the template content with shared structure (header/footer)
- For the email driver system (SES, SendGrid, etc.), see the `stacks-email` skill
