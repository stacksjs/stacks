---
name: stacks-actions
description: Use when working with Stacks server actions — creating actions in app/Actions/, auto-generated API actions from the useApi model trait, the 80+ default framework actions (auth, dashboard, commerce, content, deployment, jobs), action request/response handling, or action registration. Covers @stacksjs/actions and storage/framework/defaults/actions/.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Actions

Server actions are reusable business logic units invoked from routes, events, or CLI commands.

## Key Paths
- Core package: `storage/framework/core/actions/src/`
- Application actions: `app/Actions/`
- Default framework actions: `storage/framework/defaults/actions/`
- Framework actions (generated): `storage/framework/actions/`

## Creating an Action

```typescript
// app/Actions/NotifyUser.ts
export default {
  name: 'NotifyUser',
  description: 'Notify user after creation',

  async handle(request: any) {
    const id = request.get('id')
    const name = request.get('name')
    console.log(`User ${name} (${id}) created`)
    return { success: true }
  }
}
```

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
- Framework default actions are in `storage/framework/defaults/actions/`
- The `handle()` method is required — it receives the request object
- Actions used as event listeners also have a `handle(event)` method
- The `useApi` model trait auto-generates CRUD actions + routes
- Actions are resolved dynamically at runtime via string names
- The HealthAction at `/health` is useful for container health checks
- Login action returns `{ token: string, user: { id, email, name } }`
- All dashboard settings actions read/write from the corresponding config files
