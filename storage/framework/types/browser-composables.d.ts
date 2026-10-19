// Hand-written, like `request-context.d.ts` beside it, and handed to
// `stx typecheck` with `--lib` by the `typecheck:views` script.
//
// What a `<script client>` block can reach from stx's DEMAND-INLINE
// composables (stacksjs/stacks#2918 follow-up). These are not ordinary
// auto-imports: stx scans a client script for the names it calls and inlines
// the implementation of just those, so they exist at runtime without an
// import and are invisible to any checker that is only given the module
// declarations. `node_modules/@stacksjs/stx/dist/composables/*.d.ts` declares
// them as module exports, which is the wrong shape for a global, so nothing
// typed them here.
//
// That is how `MembershipCard.stx` turned `typecheck:views` red while working
// correctly in a browser: it calls `useMouse({ target, resetOnLeave })` and
// subscribes, which is exactly the demand-inlined API, while the only
// `useMouse` a checker could see was the unrelated no-argument one in
// `browser-composables.d.ts`.
//
// Mirrors `dist/composables/use-mouse.d.ts` rather than inventing a shape. If
// stx changes it, this drifts, and the symptom is a type error on code that
// runs - so correct it here against that file rather than loosening it.

export {}

declare global {
  interface StxMouseState {
    x: number
    y: number
    pageX: number
    pageY: number
    clientX: number
    clientY: number
    movementX: number
    movementY: number
    buttons: number
    isPressed: boolean
    isInside: boolean
  }

  interface StxMouseOptions {
    target?: Window | HTMLElement | null
    touch?: boolean
    resetOnLeave?: boolean
    type?: 'page' | 'client' | 'screen' | 'movement'
  }

  interface StxMouseRef {
    get: () => StxMouseState
    /** Returns its own unsubscribe, which is what callers store. */
    subscribe: (fn: (state: StxMouseState) => void) => () => void
    stop: () => void
  }

  /** Reactive mouse or pointer position, globally or within a target. */
  function useMouse(options?: StxMouseOptions): StxMouseRef
}
