---
name: stacks-browser
description: Use when working with browser/frontend functionality in Stacks — the useAuth composable (login, register, logout, token management), Stripe billing utilities (loadCardElement, confirmPayment), the API fetch client, browser model loading, or auto-imported browser utilities. Covers @stacksjs/browser.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Browser

Frontend/browser utilities for STX applications.

## Key Paths
- Core package: `storage/framework/core/browser/src/`
- Auto-imports: `storage/framework/browser-auto-imports.json`

## Authentication Composable (useAuth)

```typescript
const { user, isAuthenticated, login, register, logout, token, errors, loading } = useAuth()

// Login
await login({ email: 'user@example.com', password: 'secret' })

// Register
await register({ email: 'new@example.com', password: 'secret', name: 'John' })

// Logout
await logout()

// Auth guard (redirect if not authenticated)
authGuard()              // redirect to /login
authGuard({ guest: true })  // redirect if authenticated (for login page)
```

## API Client (Fetch)

```typescript
import { Fetch, initApi } from '@stacksjs/browser'

initApi({ baseUrl: '/api', onUnauthorized: () => router.push('/login') })

const users = await Fetch.get('/users')
await Fetch.post('/users', { name: 'John' })
await Fetch.patch('/users/1', { name: 'Jane' })
await Fetch.put('/users/1', data)
await Fetch.destroy('/users/1')
Fetch.setToken('bearer-token')
```

## Stripe Billing (Browser-Side)

```typescript
import { loadCardElement, loadPaymentElement, confirmCardSetup, confirmCardPayment, confirmPayment, createPaymentMethod } from '@stacksjs/browser'

// Load Stripe Elements
const cardElement = await loadCardElement(clientSecret)
const paymentElement = await loadPaymentElement(clientSecret)

// Confirm payment
const { paymentIntent, error } = await confirmCardPayment(clientSecret, elements)
const { setupIntent, error } = await confirmCardSetup(clientSecret, elements)
const { paymentIntent, error } = await confirmPayment(elements)
const { paymentIntent, error } = await createPaymentMethod(elements)
```

## Browser Model Loading

```typescript
import { loadBrowserModels, getBrowserModel, getBrowserModelNames } from '@stacksjs/browser'

await loadBrowserModels()               // loads all models from app/Models/
const User = getBrowserModel('User')
const names = getBrowserModelNames()     // ['User', 'Post', ...]
```

## Browser Query Builder

```typescript
import { browserQuery, BrowserQueryBuilder, browserAuth, createBrowserModel, createBrowserDb } from '@stacksjs/browser'

const users = await browserQuery('users').where('active', true).get()
const db = createBrowserDb({ baseUrl: '/api' })
```

## Utility Functions

```typescript
// Date
useDateFormat(date, 'YYYY-MM-DD')
useNow()

// Formatting
formatAreaSize(sqMeters)       // '1,234 sq ft' or 'X acres'
formatDistance(miles)           // '1.5 mi' or '2,640 ft'
formatElevation(feet)          // '1,234 ft'
formatDuration(seconds)        // '2h 15m'
getRelativeTime(dateString)    // '5 minutes ago'

// Async
fetchData(fetcher, { onError, fallback })

// Random
random(size?)                  // nanoid
customAlphabet(alphabet, size) // custom nanoid

// Regex (magic-regexp)
createRegExp(pattern)

// Retry
retry(fn, { retries: 3, initialDelay: 100, backoffFactor: 2 })

// Sleep
sleep(ms), wait(ms), delay(ms)
waitUntil(condition, { interval, timeout })
waitWhile(condition, options)

// Promise
createSingletonPromise(fn)
createControlledPromise()
createPromiseLock()
```

## Guards
- `notNullish(v)` — type guard for non-null/undefined
- `noNull(v)` — excludes null
- `notUndefined(v)` — excludes undefined
- `isTruthy(v)` — excludes falsy values

## Auto-Initialization
```typescript
autoInit()  // initializes all browser utilities, exposes on window.StacksBrowser
```

## Re-exports from Composables
`useDark`, `useFetch`, `useOnline`, `useStorage`, `useToggle`, `useDateFormat`, `useNow`, `usePreferredDark`

## Gotchas
- All browser utilities are auto-imported in STX templates
- `initApi()` must be called before using `Fetch`
- `loadCardElement()` requires Stripe.js to be loaded
- `publishableKey` must be set for Stripe integration
- Browser models use a different query builder than server-side models
- `autoInit()` exposes utilities on `window.StacksBrowser`
- Do NOT use `document.*`, `window.*` directly in STX templates
