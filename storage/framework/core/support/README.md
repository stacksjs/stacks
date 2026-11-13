# @stacksjs/support

Native HQ.support integration for server identity, customer events, conversations,
and the compiled stx messenger. The package has no runtime dependencies.

```ts
import { createSupportClient } from '@stacksjs/support/server'

const support = createSupportClient({
  key: process.env.SUPPORTHQ_KEY!,
  readKey: process.env.SUPPORTHQ_READ_KEY,
  project: process.env.SUPPORTHQ_PROJECT_ID!,
})

// Derive identity from your authenticated server request, never browser input.
const session = await support.createSession({ externalId: String(user.id), name: user.name })
```

Keep integration and read keys on the server. Give the browser only the public
project identifier and returned short-lived customer session. Connect using
`buddy hq:connect supporthq`; the service origin defaults to `https://hq.support`.

Writes require an idempotency key. Reuse the same key for the same operation
after an uncertain result. The client does not automatically retry writes: a
network failure can happen after the server commits. `SupportError` reports a
safe code and HTTP status, without including provider bodies or credentials.

`conversations.list` uses the read key where supplied and returns scoped summaries,
not private transcript access. A service URL uses HTTPS except local development
on localhost. Authentication is never followed across redirects.

The browser subpath imports neither server credential handling nor DOM globals:

```ts
import { createSupportBrowser } from '@stacksjs/support/browser'

// Load the compiled stx element and obtain its instance in your host integration.
const support = createSupportBrowser(messengerElement)
await support.boot({ project: 'project-id', sessionToken: session.token })
support.open()
// Always clear customer state during logout and account or workspace changes.
support.shutdown()
```

Load the web component assets separately. The lifecycle wrapper accepts the
element's documented methods and does not inject scripts, add HTML attributes,
or depend on a Stacks page's ambient bindings.
