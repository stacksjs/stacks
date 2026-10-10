---
name: stacks-composables
description: Use when choosing or implementing reactive composables in STX, data queries, forms, consent, browser APIs, motion, or debugging client delivery. Covers @stacksjs/composables, STX eager and demand browser delivery, and the difference between callable signals and module Refs.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks composables

Choose the execution surface before copying a composable signature. An STX
client script, an explicitly imported `@stacksjs/composables` module, and a
server script can expose similarly named functions with different contracts.
Read [BROWSER.md](BROWSER.md) for template delivery, forms and motion examples.

## Eager window aliases

The following markers describe only explicit eager `window.name` aliases in
`getCachedSignalsRuntime()`. They are checked by
`core/composables/tests/skill-runtime-globals.test.ts`, and are not the whole
compiler-delivered client surface.

<!-- auto-imported:begin - checked against the stx runtime by
     core/composables/tests/skill-runtime-globals.test.ts. These are the names
     `getCachedSignalsRuntime()` attaches to `window`, which is what decides
     whether a bare call resolves in a template. Do not derive this list from
     `browser-auto-imports.json`: that manifest is compile-time only, and 22 of
     the 27 `use*` it declares are absent from the runtime. -->

`useAsync`, `useClickOutside`, `useColorMode`, `useCounter`, `useDark`,
`useDebounce`, `useDebouncedValue`, `useEventListener`, `useFetch`, `useFocus`,
`useHead`, `useInterval`, `useLocalStorage`, `useMutation`, `useQuery`,
`useRef`, `useRoute`, `useSearchParams`, `useSeoMeta`, `useSessionStorage`,
`useStore`, `useThrottle`, `useTimeout`, `useToggle`, `useWebSocket`.

<!-- auto-imported:end -->

Additional STX names are exposed through `window.stx` and compiler
destructuring, or bundled from STX composables on demand. In current STX,
`useMediaQuery` and `usePreferredReducedMotion` use the first path;
`useForm`, `useScroll`, `useMouse`, `useParallax`, and
`useIntersectionObserver` use the demand path. These client-script names do
not come from the ambient `browser-auto-imports.json` manifest.

## Explicit module imports

The module surface lives in `core/composables/src/index.ts`. Import every
binding in a TypeScript module even if a template entry can use it bare.

```ts
import { useCounter } from '@stacksjs/composables'

const counter = useCounter(0, { min: 0, max: 10 })
counter.inc()
const value = counter.count.value
```

Module composables use object `Ref` values from STX: read/write `.value`,
subscribe where provided, and use the exported cleanup/control functions.
Template signals use `count()`, `.set()`, and `.update()`. Passing a callable
signal into a module helper expecting a `Ref` is not an implicit conversion.

| Task | Explicit module exports |
|---|---|
| State/storage | useCounter, useToggle, useStorage, useLocalStorage, history helpers |
| Async/data | useFetch, createFetch, useQuery, useMutation, createQueryClient, useAsyncState |
| Forms/consent | useForm, useCookieConsent |
| DOM/input | useFocus, useEventListener, onClickOutside, observers, useScroll, useMouse |
| Timing/watch | useIntervalFn, useTimeoutFn, useTimeoutPoll, watchDebounced, watchPausable |
| Media/device | useMediaQuery, usePreferredReducedMotion, useGeolocation, useDeviceOrientation |
| Browser facilities | clipboard, permissions, fullscreen, workers, virtual lists, sharing |

Inspect the barrel and the individual implementation for other exports rather
than installing a second library for a feature Stacks already has.

## Module query cache

`useQuery({ queryKey, queryFn, staleTime, enabled, client })` provides Ref
data/error/loading state, in-flight deduplication and `refetch()`.
`queryFn` receives an AbortSignal. `createQueryClient({ gcTime })` provides
scoped clients, `get`, `set`, `invalidate`, `gc`, and `clear`.
Invalidation accepts prefix keys or a predicate matcher. Optional
`refetchOnFocus` and `refetchOnReconnect` refetch stale data. Use
`unsubscribe()` when the consumer ends. For template runtime queries read
the STX contract in [BROWSER.md](BROWSER.md); their signatures differ.

## Module forms and consent

Explicit `useForm({ initialValues, schema, onSubmit, validateOn })` accepts
Stacks validators, exposes Ref values plus `field(name)` accessors, dirty/touched
state, accessible `inputProps()`, `submitButtonProps()`, and server-error
`setErrors()`. Apply a returned 422 map explicitly; fetching an error does
not automatically attach it to a form. Field arrays and a progressive HTML
fallback are not established by the primitive alone.

`useCookieConsent({ policyVersion, storageKey, onChange })` stores a versioned
decision. Necessary consent is always enabled; optional categories default to
declined. `accept`, `acceptAll`, `declineAll`, and `withdraw` change it;
`allows(category)` gates loading. A changed policy version asks again, blocked
storage falls back to no stored decision, and returned visitor consent is
independent of a signed-in session. Import this helper explicitly.

## Gotchas

- Browser capability availability and permission denial are runtime states,
  even when a helper imports successfully during SSR.
- Client observers/listeners need teardown. Read the selected helper's return
  shape; `stop`, `remove`, and `unsubscribe` are not interchangeable names.
- Module `useTimeout(ms)` returns a Ref unless controls are requested; browser
  runtime `useTimeout(callback, delay)` runs a callback. Module counter methods
  are `inc`/`dec`, never `increment`/`decrement`.
- Typechecking an ambient name proves neither its delivery nor its contract.
  Exercise a rendered template with the installed STX version.

## Source and evidence

`core/composables/src/index.ts`, individual source files, and retained
`tests/use-query.test.ts`, `tests/use-form.test.ts`,
`tests/use-cookie-consent.test.ts` and `tests/skill-runtime-globals.test.ts`
are authoritative (core paths relative to `storage/framework/`).
