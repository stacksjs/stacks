# STX browser delivery and contracts

This reference applies to `<script client>` in the current installed STX.
The eager runtime, client-script compiler and demand bundler cooperate. The
ambient browser manifest is a type declaration input, not this delivery map.

## Delivery paths

1. Eager runtime primitives are exposed on `window.stx`; the compiler provides
   the names a script uses. Some also have explicit bare `window.name` aliases.
2. STX scans authored calls for supported demand composables and emits their
   browser code. `useForm`, observers, mouse/parallax and scroll helpers use
   this path. The deprecated internal name `SERVER_ONLY_COMPOSABLES` is a
   demand allowlist, not a statement that those helpers cannot run in browsers.
3. Explicit application-module imports are bundled separately. Their bindings
   do not leak into another imported module or magically change Ref contracts.

Installed STX 0.2.422 delivers `useForm`, `useIntersectionObserver`,
`useMouse`, `useParallax`, and `useScroll` on demand. It eagerly supplies
`useMediaQuery` and `usePreferredReducedMotion` through the runtime/compiler.
An older installation must be checked against its own runtime and demand
implementation rather than a newer docs list. Demand legacy helpers commonly
expose getters, `get()`, `subscribe()`, and `stop()`. Their getters are not
automatically signal-tracked template values.

## Browser and module contracts differ

| Name | STX client runtime | Explicit @stacksjs/composables |
|---|---|---|
| useCounter | numeric count getter, inc/dec/set/reset, subscribe | count Ref, inc/dec/set/reset/get |
| useFocus | isFocused getter, focus/blur/subscribe | focused Ref, focus/blur |
| useTimeout | callback then delay, pending getter and start/stop | interval then options, Ref or controls |
| useLocalStorage | callable signal | object Ref |
| useForm | schema then initialValues, signal-backed property records | options object, Stacks schema rules, Ref values and field accessors |

## Motion and observers

Prefer CSS transitions or scroll-driven animation. Use the eager reduced-motion
signal for anything beyond hover. Attach native browser observation in a mount
hook and clean it up at component destruction:

```html
<script client>
const card = useRef('card')
const visible = state(false)
const reduceMotion = usePreferredReducedMotion()

onMount(() => {
  const observer = useIntersectionObserver(
    () => card.current,
    entry => visible.set(entry.isIntersecting),
  )
  onDestroy(() => observer.stop())
})
</script>

<article ref="card" :class="visible() || reduceMotion() ? 'opacity-100' : 'opacity-0'">
  Content
</article>
```

STX `useScroll()` observes window scrolling; `useMouse(options?)` tracks
mouse state; `useParallax()` tracks device orientation. Read their actual
`get()/subscribe()/stop()` result before wiring a signal adapter. The explicit
Stacks versions accept different targets/options and return Refs. Include
permission-denied and unsupported-device behavior, and avoid doing layout work
on every event when CSS can perform it.

## Forms

Bare `useForm(schema, initialValues?)` selects STX's form implementation. Its
schema contains STX Validator objects (the `v` builder is an explicit package
export, not an eager bare global). `form.values.email`, `form.errors.email`,
touched/dirty/validating records are signal-backed properties;
`getFieldState(name)`, `validateField(name)`, `validate()` and
`handleSubmit(handler)` follow that implementation. The explicit
`@stacksjs/composables` implementation instead takes
`{ initialValues, schema, onSubmit }` and Stacks `schema.string()` rules.
Never paste one implementation's options into the other.

## Data and session scope

STX `useQuery` and `useFetch` use callable state and can consume server
hydration data. `clearServerData(key?)` invalidates consumed server data after
a mutation. Persisted account state uses `keptState`, `cachedQuery`, and
`setKeptScope`; establish the signed-in account scope before creating values,
flush pending writes when appropriate, and forget that scope on sign-out.
Ordinary localStorage is not account-scoped automatically.

## Verify the actual delivery

Inspect installed STX `runtime-globals`, `signals`, `client-script`,
`framework-composables`, and `unresolved-identifiers` modules. The retained
STX tests `framework-composables.test.ts`,
`framework-composables-dist-layout.test.ts`,
`forms/use-form-reactive.test.ts` and `signals/client-api-delivery.test.ts`
check different delivery paths. Stacks' eager alias test covers one path only.
