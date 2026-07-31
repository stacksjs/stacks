---
name: stacks-actions
description: Use when working with Stacks server actions — creating actions in app/Actions/, auto-generated API actions from the useApi model trait, the 80+ default framework actions (auth, dashboard, commerce, content, deployment, jobs), action request/response handling, or action registration. Covers @stacksjs/actions and storage/framework/defaults/app/Actions/.
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
import { Action } from '@stacksjs/actions'
import { toSnakeCaseKeys } from '@stacksjs/orm'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Create Widget',
  description: 'Create a widget',
  method: 'POST',
  model: Widget,

  async handle(request: RequestInstance) {
    await request.validate()

    const widget = await Widget.create(toSnakeCaseKeys(request.all()))

    return response.json(widget, 201)
  },
})
```

Use the `Action` class, an explicit HTTP method, and `response` helpers. Store and
update actions should set `model` and call `request.validate()` before persisting
input. Import framework helpers explicitly, following the default actions.

## Resource Action Contract

Show, update, and destroy actions must distinguish malformed identifiers,
missing records, invalid input, and operational failures:

1. Read resource identifiers from `request.getParam('id')`, never from the
   request body.
2. Convert the value to a number and require a safe positive integer. Return
   `422` when it is malformed.
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

When a model defines `useApi`, the framework auto-generates REST actions:

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

## Default Framework Actions (80+)

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
- Actions are resolved dynamically at runtime via string names
- The HealthAction at `/health` is useful for container health checks
- Login action returns `{ token: string, user: { id, email, name } }`
- All dashboard settings actions read/write from the corresponding config files
