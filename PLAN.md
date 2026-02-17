# High-Priority Features Implementation Plan

## Current State Assessment

After thorough exploration, much more exists than initially thought:

| Feature | Status | What's Missing |
|---------|--------|----------------|
| Gates & Policies | ✅ Complete | — |
| Token Auth (Sanctum-like) | ✅ Complete | — |
| Login/Register/Reset/2FA/Passkeys | ✅ Complete | — |
| Soft Deletes | ✅ Complete | — |
| Eager Loading (with) | ✅ Complete | — |
| Polymorphic Relations | ✅ Complete | — |
| Accessors/Mutators | ✅ Complete | — |
| Change Tracking (isDirty/isClean) | ✅ Complete | — |
| Middleware Pipeline | ✅ Exists | Groups, global stack, except/only |
| Session Management | ⚠️ In-memory only | Persistent drivers, flash data, config |
| RBAC | ❌ Missing | Roles, permissions, DB tables, middleware |
| Email Verification | ❌ Missing | Tokens, endpoints, enforcement |
| ORM: Query Scopes | ❌ Missing | Named scopes, global scopes |
| ORM: Model Casts | ❌ Missing | Attribute casting system |
| ORM: Pivot Operations | ❌ Missing | attach/detach/sync for belongsToMany |

---

## Implementation Plan (6 items)

### 1. RBAC System (Roles & Permissions)

**Location**: `storage/framework/core/auth/src/`

**New files:**
- `rbac.ts` — Core RBAC engine: Role class, Permission class, HasRoles/HasPermissions mixins
- `rbac-middleware.ts` — Route middleware: `role:admin`, `permission:edit-posts`

**What it adds:**
- `Role` and `Permission` interfaces and helper functions
- `hasRole(user, role)`, `hasAnyRole(user, roles)`, `hasAllRoles(user, roles)`
- `hasPermission(user, perm)`, `hasAnyPermission()`, `hasAllPermissions()`
- `assignRole(userId, role)`, `removeRole(userId, role)`
- `givePermission(userId, perm)`, `revokePermission(userId, perm)`
- `roleMiddleware(...roles)` — returns middleware handler
- `permissionMiddleware(...permissions)` — returns middleware handler

**New model definition file:**
- `storage/framework/models/Role.ts` — Role model with `name`, `guard_name`, `description`
- `storage/framework/models/Permission.ts` — Permission model with `name`, `guard_name`, `description`

**Database tables (via model definitions):**
- `roles` (id, name, guard_name, description, timestamps)
- `permissions` (id, name, guard_name, description, timestamps)
- `role_user` (role_id, user_id, timestamps) — pivot
- `permission_role` (permission_id, role_id, timestamps) — pivot
- `permission_user` (permission_id, user_id, timestamps) — pivot (direct assignments)

**Default middleware additions:**
- `storage/framework/defaults/app/Middleware/Role.ts`
- `storage/framework/defaults/app/Middleware/Permission.ts`

**Update:**
- `storage/framework/core/auth/src/index.ts` — export RBAC
- `storage/framework/defaults/app/Middleware.ts` — add `role` and `permission` aliases

---

### 2. Session Management (Persistent Drivers)

**Location**: `bun-router/packages/bun-router/src/middleware/`

**Modify:**
- `session.ts` — Refactor to use a `SessionStore` interface with pluggable drivers

**New files in bun-router:**
- `session/memory-store.ts` — In-memory store (current behavior, extracted)
- `session/redis-store.ts` — Redis-backed sessions (uses `ioredis` or native Redis)
- `session/database-store.ts` — SQLite/MySQL/Postgres sessions via query
- `session/file-store.ts` — File-based sessions (JSON in temp dir)
- `session/index.ts` — Factory: `createSessionStore(driver, options)`

**Session features to add:**
- Flash data: `flash(key, value)`, `getFlash(key)`, `reflash()`, `keep(keys)`
- Session regeneration: `regenerate()` — new ID, keep data
- Session invalidation: `invalidate()` — new ID, clear data
- Touch/extend: `touch()` — reset TTL
- Configuration object for driver, TTL, cookie name, encryption, etc.

**Update:**
- `bun-router/packages/bun-router/src/types/core.ts` — already has `SessionStore` interface, ensure it matches

---

### 3. Middleware Groups & Global Stack

**Location**: `bun-router/packages/bun-router/src/router/`

**New file:**
- `middleware-groups.ts` — Middleware group registry

**What it adds:**
```typescript
// Define groups
middlewareGroups.define('web', ['session', 'csrf', 'cors'])
middlewareGroups.define('api', ['throttle:60,1', 'cors'])

// Use on routes
router.group({ middleware: 'web' }, () => { ... })
router.group({ middleware: 'api' }, () => { ... })
```

- `MiddlewareGroupRegistry` class with `define()`, `get()`, `extend()`
- Global middleware stack with `pushMiddleware()`, `prependMiddleware()`
- `except()` and `only()` route-level middleware exclusion
- Middleware priority ordering (numbered priorities)

**Modify:**
- `bun-router/packages/bun-router/src/router/middleware.ts` — integrate group resolution
- `stacks/storage/framework/core/router/src/stacks-router.ts` — wire up groups

---

### 4. ORM Enhancements (Scopes, Casts, Pivot Operations)

**Location**: `stacks/storage/framework/orm/src/utils/base.ts` and `stacks/storage/framework/core/orm/src/generate.ts`

#### 4a. Named Query Scopes

**Modify `generate.ts`** — When model definition has `scopes`, generate scope methods:

```typescript
// In model definition:
scopes: {
  active: (query) => query.where('status', '=', 'active'),
  published: (query) => query.whereNotNull('published_at'),
  recent: (query) => query.orderByDesc('created_at').take(10),
}

// Generated:
static active(): ModelName { ... }
static published(): ModelName { ... }
static recent(): ModelName { ... }
```

#### 4b. Global Scopes

**Modify `base.ts`** — Add global scope support:

```typescript
// Register global scopes
static addGlobalScope(name: string, scope: (query) => query)
static withoutGlobalScope(name: string)
static withoutGlobalScopes()
```

Soft deletes already filter `deleted_at IS NULL` — formalize this as a global scope.

#### 4c. Model Casts

**Modify `generate.ts`** — When model attributes have `cast` property:

```typescript
// In model definition attribute:
{ cast: 'boolean' }   // DB 0/1 → JS true/false
{ cast: 'number' }    // String → Number
{ cast: 'date' }      // String → Date object
{ cast: 'json' }      // JSON string → parsed object
{ cast: 'array' }     // JSON string → array
```

Apply casts in getters/setters of generated models.

#### 4d. Pivot Operations (attach/detach/sync)

**Modify `base.ts`** — Add to belongsToMany relationship handling:

```typescript
// On a loaded relationship
await user.roles().attach(roleId)
await user.roles().attach([roleId1, roleId2], { assigned_by: adminId })
await user.roles().detach(roleId)
await user.roles().detach() // detach all
await user.roles().sync([roleId1, roleId2])
await user.roles().toggle([roleId1, roleId2])
```

---

### 5. Email Verification

**Location**: `stacks/storage/framework/core/auth/src/`

**New files:**
- `email-verification.ts` — Core verification logic

**What it adds:**
- `sendVerificationEmail(user)` — Generate token, send email with verification link
- `verifyEmail(userId, token)` — Verify token and set `email_verified_at`
- `isEmailVerified(user)` — Check verification status
- `resendVerificationEmail(user)` — Resend with rate limiting

**New action files:**
- `storage/framework/defaults/app/Actions/Auth/VerifyEmailAction.ts` — GET `/verify-email/{id}/{token}`
- `storage/framework/defaults/app/Actions/Auth/ResendVerificationAction.ts` — POST `/resend-verification`

**New middleware:**
- `storage/framework/defaults/app/Middleware/EnsureEmailIsVerified.ts`

**Update:**
- `storage/framework/core/auth/src/index.ts` — export email verification
- `storage/framework/defaults/app/Middleware.ts` — add `verified` alias

---

### 6. API Token Auth — ALREADY COMPLETE

No work needed. The following already exists:
- Personal access tokens with scopes
- Token creation, revocation, refresh
- Token abilities checking (`tokenCan`, `tokenCanAll`, `tokenCanAny`)
- Wildcard scopes
- Bearer token guard
- API endpoints: create, list, revoke tokens

---

## Implementation Order

1. **RBAC** (most impactful — devs expect roles/permissions)
2. **Email Verification** (small, completes the auth story)
3. **Session Drivers** (foundational for web apps)
4. **Middleware Groups** (DX improvement for route organization)
5. **ORM Enhancements** (query scopes, casts, pivot ops)
