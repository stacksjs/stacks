---
name: stacks-composables
description: Use when creating or using reactive composables in STX templates — 90+ composables for state management, DOM interaction, sensors, animation, browser APIs, async operations, or the complete list of auto-imported composables. Covers @stacksjs/composables.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Composables

90+ reactive composables for STX templates. All are auto-imported in STX templates.

## Key Path
- Core package: `storage/framework/core/composables/src/`

## Core Reactive Primitives

```typescript
// From _shared.ts
type MaybeRef<T> = T | Ref<T>
type MaybeRefOrGetter<T> = T | Ref<T> | (() => T)
unref(val)           // unwrap Ref
toValue(val)         // unwrap Ref or getter
isRef(val)           // type guard
```

## State & Reactivity
- `useToggle(initial?)` → `[Ref<boolean>, toggle]`
- `useCounter(initial?)` → `{ count, increment, decrement, set, reset }`
- `useStepper(steps, initial?)` → step navigation
- `usePrevious(value)` → previous value
- `useCycleList(list)` → cycle through items

## Storage
- `useStorage(key, defaultValue, storage?)` → persistent Ref
- `useLocalStorage(key, defaultValue)` → localStorage-backed Ref
- `useSessionStorage(key, defaultValue)` → sessionStorage-backed Ref

## Time & Date
- `useNow(options?)` → `Ref<Date>` (auto-updating)
- `useDateFormat(date, format)` → `Ref<string>`
- `useTimeAgo(date)` → relative time string
- `useTimestamp(options?)` → `Ref<number>`
- `useInterval(fn, ms)` → interval control
- `useIntervalFn(fn, ms)` → interval with pause/resume
- `useTimeout(ms)` → timeout control
- `useTimeoutFn(fn, ms)` → delayed execution

## DOM & Browser
- `useWindowSize()` → `{ width, height }`
- `useWindowScroll()` → `{ x, y }`
- `useWindowFocus()` → `Ref<boolean>`
- `useDocumentVisibility()` → `Ref<string>`
- `useFullscreen(el?)` → `{ isFullscreen, enter, exit, toggle }`
- `useTitle(title)` → document title binding
- `useFavicon(url)` → favicon binding
- `useCssVar(prop, el?)` → CSS variable binding
- `useActiveElement()` → currently focused element
- `useTextSelection()` → selected text
- `useTextDirection()` → `Ref<'ltr' | 'rtl'>`
- `useNavigatorLanguage()` → browser language

## Mouse & Touch
- `useMouse()` → `{ x, y, sourceType }`
- `useMouseInElement(el)` → mouse position relative to element
- `useMousePressed()` → `{ pressed, sourceType }`
- `usePointer()` → pointer events
- `useSwipe(el)` → swipe detection
- `usePointerSwipe(el)` → pointer swipe
- `useDraggable(el)` → make element draggable
- `useDropZone(el)` → drop zone detection
- `onLongPress(el, handler)` → long press detection
- `onClickOutside(el, handler)` → click outside detection

## Sensors
- `useGeolocation()` → `{ coords, locatedAt, error }`
- `useDeviceMotion()` → acceleration & rotation
- `useDeviceOrientation()` → alpha, beta, gamma
- `useBattery()` → `{ charging, chargingTime, level }`
- `useDevicePixelRatio()` → `Ref<number>`
- `useScreenSafeArea()` → safe area insets

## Observers
- `useIntersectionObserver(el, callback)` → visibility detection
- `useResizeObserver(el, callback)` → size changes
- `useMutationObserver(el, callback)` → DOM mutations
- `useElementBounding(el)` → `{ top, left, width, height }`
- `useElementVisibility(el)` → `Ref<boolean>`
- `useElementHover(el)` → `Ref<boolean>`

## Async
- `useAsyncState(fn, initial)` → `{ state, isReady, isLoading, error, execute }`
- `useAsyncQueue(tasks)` → sequential async execution
- `computedAsync(fn)` → async computed value
- `computedEager(fn)` → immediately evaluated computed

## Network
- `useFetch(url, options?)` → fetch wrapper with reactive state
- `useWebSocket(url)` → WebSocket connection
- `useEventSource(url)` → SSE connection
- `useOnline()` → `Ref<boolean>` (network status)

## Input & Focus
- `useFocus(el)` → `{ focused, focus, blur }`
- `useFocusWithin(el)` → any child focused
- `useKeyModifier(key)` → modifier key state
- `usePermission(name)` → permission state
- `useShare(options)` → Web Share API

## Utilities
- `useDebounceFn(fn, ms)` → debounced function
- `useThrottleFn(fn, ms)` → throttled function
- `useDebouncedRef(ref, ms)` → debounced ref updates
- `useThrottledRef(ref, ms)` → throttled ref updates
- `watchDebounced(source, callback, ms)` → debounced watcher
- `watchThrottled(source, callback, ms)` → throttled watcher
- `watchOnce(source, callback)` → one-time watcher
- `whenever(source, callback)` → watch for truthy
- `until(source).toBe(value)` → wait for value
- `syncRef(refA, refB)` → bidirectional sync

## Dark Mode
- `useDark()` → `Ref<boolean>`
- `usePreferredDark()` → system preference
- `usePreferredColorScheme()` → color scheme preference

## Media
- `useMediaQuery(query)` → `Ref<boolean>`
- `usePreferredContrast()` → contrast preference
- `usePreferredLanguages()` → language preferences
- `usePreferredReducedMotion()` → reduce motion preference

## State Patterns
- `createEventHook()` → typed event hook
- `createGlobalState(fn)` → shared state across components
- `createSharedComposable(fn)` → shared composable instance
- `refDefault(ref, defaultValue)` → ref with default
- `refAutoReset(value, ms)` → auto-resetting ref
- `makeDestructurable(obj, arr)` → support both destructuring styles
- `useIdle(ms)` → user idle detection
- `usePageLeave()` → detect page leave
- `useFps()` → frames per second
- `useMounted()` → `Ref<boolean>` mount state
- `tryOnMounted(fn)` → safe onMounted
- `useObjectUrl(blob)` → object URL with auto-cleanup

## Script & Style Injection
- `useScriptTag(src, onLoaded?)` → inject `<script>`
- `useStyleTag(css)` → inject `<style>`

## Math
- `useAbs`, `useAverage`, `useCeil`, `useClamp`, `useFloor`, `useMax`, `useMin`, `usePrecision`, `useRound`, `useSum`, `useTrunc`
- `and`, `or`, `logicNot`, `logicOr`

## Gotchas
- All composables are auto-imported in STX templates — no import needed
- NEVER use vanilla JS (`var`, `document.*`, `window.*`) in STX `<script>` tags
- Only use stx-compatible code: signals, composables, directives
- Auto-imports defined in `storage/framework/browser-auto-imports.json`
- Many composables require a browser environment (won't work server-side)
- `useStorage` persists to localStorage by default
