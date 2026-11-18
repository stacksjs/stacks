---
name: stacks-actions
description: Use when working with Stacks server actions - creating actions in app/Actions/, auto-generated API actions from the useApi model trait, the 780 default framework actions (auth, dashboard, commerce, content, deployment, jobs), action request/response handling, or action registration. Covers @stacksjs/actions and storage/framework/defaults/app/Actions/.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Actions

Server actions are reusable business logic units invoked from routes, events, or CLI commands.

## Key Paths
- Core package: `storage/framework/core/actions/src/`
- Application actions: `app/Actions/`
- Default framework actions: `storage/framework/defaults/app/Actions/`
- Framework actions (generated): `storage/framework/actions/`

## Creating an Action

```typescript
// app/Actions/CreateWidget.ts
import { Action } from '@stacksjs/actions/runtime'
import { toSnakeCaseKeys } from '@stacksjs/orm'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Create Widget',
  description: 'Create a widget',
  method: 'POST',
  model: Widget,

  async handle(request) {
    await request.validate()

    const widget = await Widget.create(toSnakeCaseKeys(request.all()))

    return response.created(widget)
  },
})
```

Use the `Action` class, an explicit HTTP method, and `response` helpers. Store and
update actions should set `model` and call `request.validate()` before persisting
input. Import framework helpers explicitly, following the default actions.

Let `handle(request)` infer its request type. An explicit broad annotation loses
the model or validation field types that `Action` can derive. The typed Action
contract lives in `core/actions/src/action.ts`; the execution pipeline lives in
`core/router/src/stacks-router.ts`.

## Validation, lifecycle, and typed clients

An explicit `validations` object is inferred from its validators and runs
automatically before `authorize`, `before`, and `handle`. A `model` supplies
the rules used by an explicit `request.validate()` call; do not assume attaching
a model means every custom handler has already validated all its input.

```ts
import { Action } from '@stacksjs/actions/runtime'
import { schema } from '@stacksjs/validation'

export default new Action({
  method: 'POST',
  validations: {
    title: { rule: schema.string().min(1).max(120) },
  },
  async handle(request) {
    return { title: request.get('title') }
  },
})
```

`authorize` can return true, false, or an exact Response; false short-circuits
with 403. `before` can prepare context or return a Response early. Both run
after declared validation. Directly registered actions and action strings use
the same `wrapAction` pipeline. Register an imported action with
`createTypedRouter` when its inferred request/response types should reach a
`createTypedClient`; lazy strings do not carry that response inference.

`responses`, `responseHeaders`, and `requestHeaders` enrich OpenAPI documentation.
They describe the contract and do not validate the actual response at runtime.
Test the endpoint's wire shape. `apiResponse` controls JSON formatting;
returning a raw Response owns the wire format and yields unknown client output.

`dependencies` lazily creates per-action dependencies exposed through
`this.deps`. `overrideDependencies` and `resetDependencies` let a test replace
external boundaries without module-wide mocking. They do not justify mocking
every internal collaborator or replacing a real database test with a fake.

### A refused form goes back to its page

What a refused request is answered with follows what the caller asked for,
never the endpoint (stacksjs/stacks#3309):

| Caller | Answer |
|---|---|
| `fetch()`, an API client, anything that did not ask for a page | `422` with `{ success: false, message: 'Validation failed', errors }`, as always |
| A browser submitting an HTML form (`Accept` has `text/html`, not a GET) | `303` back to the page the form was on, with the messages and what was posted |

A script that asks for HTML is still a script: when the browser says what it
is fetching (`Sec-Fetch-Dest`), only a document or a frame counts as a page.
An action or route group with `apiResponse: true` answers JSON to everyone.

`validations` run before `handle()`, so an action cannot do this for itself.
The browser used to get the 422 body: a page of JSON with the back button as
the only way out. Do not work around it in `handle()` with a hand-rolled
`response.json({ error }, 422)`: declare the rule and let the router answer.
`request.validate()` inside a handler is answered the same way.

The page reads what came back, in a `<script server>`:

```html
<script server>
const emailError = requestContext.error('email')            // '' when there is none
const emailValue = requestContext.old('email', cart.email)  // what was typed, else the saved value
</script>

<input type="email" name="email" value="{{ emailValue }}" aria-invalid="{{ emailError ? 'true' : 'false' }}">
@if (emailError)
  <p role="alert">{{ emailError }}</p>
@endif
```

- `requestContext.errors()` is every message by field (`{}` when nothing was
  refused), `error(field)` the first for one field, `hasErrors()` whether
  there are any, `old(field, fallback)` what was posted and `oldValues(field)`
  every value of a repeated field.
- **Shown once.** They travel in a cookie (`stacks_form_flash`) signed with
  `APP_KEY`, good for two minutes and for the one page it names. The page's
  server removes it with the response that showed it. With no `APP_KEY` there
  is nothing to sign with, and the browser gets a plain page listing the
  messages instead.
- **Never a secret.** A field whose name says password, token, secret, key or
  card is not sent back, and nor is a file. Draw those empty.
- **Only to this application's own page.** The form has to be on the same
  origin (`Sec-Fetch-Site: same-origin`, or a matching host for a browser too
  old to send it). A form on another site, or one with no `Referer`, gets the
  plain page of messages and is not redirected.
- What was typed is dropped, longest value first, when it would not fit a
  cookie. The messages always arrive.
- A form says a list by repeating a field name, and one occurrence arrives as
  a string. A rule that asks for `schema.array()` takes it as a list of one,
  and an empty field as an empty list. A value is never split on commas.
- A ticked checkbox with no `value` sends `on`, which a `schema.boolean()`
  rule takes as true, like `true` and `1`.

A refusal only `handle()` can know about ("your cart is empty", "that item
has gone") is answered with `refuse()` from `@stacksjs/router`, never with a
hand-written `response.json({ error }, 400)` (stacksjs/stacks#3311):

```ts
import { refuse } from '@stacksjs/router'

if (!cart)
  return refuse('Your cart is empty.', { status: 400 })
if (!deliversTo(zip))
  return refuse('We do not deliver to that postcode yet.', { field: 'shipping_zip' })
```

- A caller that asked for data gets `{ error: message }` with that status
  (`422` when none is given), plus `errors` by field when `field` is named:
  the body such actions already wrote.
- A browser form goes back to its page with what was posted. A message with
  a `field` is read with `requestContext.error(field)`; one without is about
  the whole form and is read with `requestContext.formError()`.
  `hasErrors()` is true for either.
- `authorize` and `before` can return one too.
- With no page to go back to, the browser gets the plain page of messages,
  with the status the action chose.

```html
<script server>
const formError = requestContext.formError()
</script>

@if (formError)
  <p role="alert">{{ formError }}</p>
@endif
```

A browser form refused for its CSRF token (a tab left open past the token's
life, or a second tab that replaced it) goes back to its page the same way,
with a sentence for the whole form and what was typed. The action does not
run. A script still gets the `403`, and a form posted from another site is
never sent back to a page of this one. A middleware of your own can do the
same by marking the error it throws with `FORM_REFUSAL` (`{ message, status }`).

A form can only send text, files and a name repeated for a list, and an
unticked checkbox sends nothing. `buddy doctor` reads every page's plain POST
form, finds the action it posts to in the route table, and warns, with the
file and line, about each rule that form can never meet: an object, a
required field the form has no control for, a required yes or no only a
checkbox sends, or a checkbox, radio or option value the rule refuses
(stacksjs/stacks#3311). A form whose address or field names are computed on
the page is not read.

Not covered yet: a form submitted with `method="get"`. It is a navigation, so
a failed rule is still answered with the 422 body; going back to its page
with a cookie is a different design, since the query string already holds
what was typed.

The shipped checkout is the worked example: the contact and shipping steps
declare their fields (`Actions/Storefront/CheckoutContactAction.ts`,
`CheckoutShippingAction.ts`), and every storefront action refuses an empty
cart with `refuse()`. The pages are `views/checkout/*.stx` and `views/cart.stx`.
Tests: `core/router/tests/form-validation-refusal.test.ts`,
`core/router/tests/form-action-refusal.test.ts`,
`core/config/tests/form-flash.test.ts`, and
`core/buddy/tests/refused-form-page.test.ts`, which posts a form through each
view server and reads the page that comes back.

### A form that worked goes back to its page

The same split holds when the action succeeds (stacksjs/stacks#3312). A
browser form the action answers with **data** (an object, a list, a string,
nothing, or a JSON `Response`) is sent back (`303`) to the page it was on. A
`fetch()` or API caller gets the body, unchanged. The data in a tab was a page
of JSON that said nothing a person could read: from it, "revoked" and "broken"
looked the same.

Say what happened with `notice`, in the words the person would use about the
control they pressed:

```ts
export default new Action({
  name: 'RevokeTokenAction',
  method: 'POST',
  notice: result => result.already_revoked ? 'That token was already revoked' : 'Token revoked',
  async handle(request) {
    // ...
    return { id: token.id, revoked_at: token.revoked_at, already_revoked: false }
  },
})
```

```html
<script server>
const notice = requestContext.notice()   // '' when there is nothing to say
</script>

@if (notice)
  <p role="status">{{ notice }}</p>
@endif
```

- **The words are yours.** `notice` is a string, or a function of what
  `handle` returned and the request. The framework never makes one up: "Done"
  cannot say which of the controls on a page just worked.
- **No notice, or an empty one, goes back and says nothing.** Right for a POST
  that only reads. No cookie is set, so the page draws no empty bar.
- **What the action built itself is left alone**: a page it rendered (an HTML
  `Response`), a redirect, an error status, a download, a stream. A secret
  shown once, such as a new API token, must not travel in a redirect, so
  answer with a rendered page that carries it.
- With no page of this application to go back to (no `Referer`, another site),
  a notice is shown on a small page of its own; with no notice the body is
  sent as before. With no `APP_KEY`, the notice is shown on that small page.
- Do not write the split by hand (`if (accept.includes('text/html')) return
  response.redirect(...)`). Return the data and declare the notice, and
  `next` when the form should go on somewhere else.

To send the browser on instead of back, say where with `next`, a path of this
application or a function of the result and the request:

```ts
export default new Action({
  name: 'CheckoutShippingAction',
  method: 'POST',
  next: '/checkout/payment',
  async handle(request) {
    // ...
    return { ok: true, next: '/checkout/payment' }
  },
})

// next: result => `/orders/${result.order_id}`
```

- A script gets the body and is never redirected. A refusal still goes back
  to the form's own page. A `notice` goes with the browser to the next page.
- Only ever a path on this application. A string that is not one fails when
  the route is registered. A function's answer that is not one (an address
  taken from the request) is not followed, and the browser goes back to the
  form's page instead, so `next: (_, request) => request.get('redirect')`
  cannot send anyone to another site.
- `notice` and `next` are told only what `handle` answered when it did what
  was asked: `refuse()` is left out of `result`'s type. When `handle` reads
  its request without a type written on it, declare `handle` first, because
  TypeScript works out what it returns in the order the object is written.

The shipped cart is the worked example (`Actions/Storefront/UpdateCartItemAction.ts`,
`views/cart.stx`), and the checkout steps declare `next`
(`CheckoutContactAction`, `CheckoutShippingAction`, `PlaceOrderAction`,
`AddToCartAction`). Tests: `core/router/tests/form-success-answer.test.ts`,
`core/router/tests/form-next-page.test.ts`, and
`core/buddy/tests/refused-form-page.test.ts` for the cart page.

`Precognition: true` or `?_validate=1` requests a validation-only probe.
`Precognition-Validate-Only` narrows explicit validation fields. Probes stop
before authorization/hooks/handler side effects, and do not magically run
custom `request.validate()` calls inside `handle`.

For event actions, declare `invocation: 'event'` and infer the payload from
`validations` when supplied. Event discovery calls `handle(payload, event)`;
it does not hand an HTTP Request to an event handler.

## Resource Action Contract

Show, update, and destroy actions must distinguish malformed identifiers,
missing records, invalid input, and operational failures:

1. Read resource identifiers from `request.getParam('id')`, never from the
   request body.
2. Validate its actual identifier contract. Numeric resource IDs require a safe
   positive integer; UUIDs or string keys need their own validation. The built-in
   Commerce contract returns `422` for malformed numeric IDs.
3. Validate update input with the action model, then normalize persisted keys
   with `toSnakeCaseKeys(request.all())` when the service expects database
   column names.
4. Core update services return `undefined` when the row does not exist. Core
   destroy services return `false`. They throw only for invalid domain input,
   conflicts, or real operational failures.
5. Return `404` when show or update returns `undefined`, or destroy returns
   `false`. Never return a successful `null`, an unconditional `204`, or a
   generic `500` for an absent row.
6. Preserve domain status codes such as `409` for uniqueness conflicts and
   `422` for relationship or state validation.

Share identifier and not-found response helpers inside a domain instead of
copying the contract across every resource. The built-in Commerce actions use
`Actions/Commerce/commerce-action.ts` as the reference implementation.

## Auto-Generated API Actions (useApi Trait)

When a model defines `useApi`, the runtime registers native CRUD routes and
handlers from the merged model registry. It does not require generated action
files or a separate model-class generation step:

```typescript
defineModel({
  name: 'Product',
  traits: {
    useApi: {
      uri: 'products',
      routes: ['index', 'store', 'show', 'update', 'destroy']
    }
  }
})
```

This generates:
- `GET /api/products` → Index action (list all)
- `POST /api/products` → Store action (create)
- `GET /api/products/{id}` → Show action (get one)
- `PUT /api/products/{id}` → Update action
- `DELETE /api/products/{id}` → Destroy action

## Default framework action families

### Authentication Actions
- `LoginAction` — POST /login (validates email + password, returns token + user)
- `RegisterAction` — POST /register
- `LogoutAction` — POST /logout (auth required)
- `RefreshTokenAction` — POST /auth/refresh
- `CreateTokenAction` — POST /auth/token
- `ListTokensAction` — GET /auth/tokens (auth required)
- `RevokeTokenAction` — DELETE /auth/tokens/{id}
- `GetMeAction` — GET /me (auth required)
- `PasskeyRegistrationAction` — passkey authentication options

### Dashboard Settings Actions (40+)
For each settings category (AI, Analytics, App, Cache, Cloud, Database, DNS, Email, Environment, FileSystems, Hashing, Library, Logging, Notifications, Payment, Ports, Queue, SearchEngine, Security, Services, Storage, Team, UI):
- `Get{Category}SettingsAction` — read current settings
- `Update{Category}SettingsAction` — update settings

### Commerce Actions
- CRUD actions for: Products, Orders, Customers, Payments, Coupons, GiftCards, Reviews, Shipping, DeliveryRoutes, TaxRates, LicenseKeys, etc.

### Content Actions
- CRUD actions for: Posts, Pages, Authors, Categories, Tags, Comments

### System Actions
- `HealthAction` — GET /health (returns status, uptime, memory, PID, Bun version)
- `GetUserCountAction` — user count for dashboard
- `GetSubscriberCountAction` — subscriber count
- Deployment CRUD actions
- Job monitoring actions
- Notification actions
- Request analytics actions

## Action Handler Pattern

Actions receive the enhanced request object:
```typescript
async handle(request: EnhancedRequest) {
  const name = request.get('name')         // input value
  const email = request.input('email')     // alias
  const all = request.all()                // all input
  const user = await request.user()        // authenticated user

  return { success: true, data: { ... } }
}
```

## Using Actions in Routes

```typescript
// String-based (auto-loaded)
route.post('/users', 'Actions/CreateUser')

// In events (app/Events.ts)
{ 'user:registered': ['SendWelcomeEmail'] }  // action name as listener
```

## CLI Commands
- `buddy make:action [name]` — scaffold a new action

## Gotchas
- Application actions go in `app/Actions/`
- Framework default actions are in `storage/framework/defaults/app/Actions/`
- The `handle()` method is required — it receives the request object
- Actions used as event listeners also have a `handle(event)` method
- The `useApi` model trait auto-generates CRUD actions + routes
- Custom actions retain their own domain contract; generic CRUD also applies
  model middleware, ownership, dashboard roles and per-row policy checks.
- Actions are resolved dynamically at runtime via string names
- The HealthAction at `/health` is useful for container health checks
- Login action returns `{ token: string, user: { id, email, name } }`
- All dashboard settings actions read/write from the corresponding config files
