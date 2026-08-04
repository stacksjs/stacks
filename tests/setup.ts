/**
 * Test Setup
 *
 * Runs before every test file. Sets environment variables that must
 * be present before any @stacksjs/* packages are evaluated, then
 * initialises the test environment.
 */

// Env vars that config reads at module-evaluation time
if (!Bun.env.STRIPE_SECRET_KEY)
  Bun.env.STRIPE_SECRET_KEY = 'sk_test_fake_key_for_testing'

import { applyRuntimeDirectoryEnv } from '@stacksjs/path'
import { setupTestEnvironment } from '@stacksjs/testing'

setupTestEnvironment()

// The suite does not go through the preloader, so point stx and ts-cloud at
// `storage/` here too. Without it a test that renders a template or touches a
// cloud helper would write to `.stx` / `.ts-cloud` in the project root.
applyRuntimeDirectoryEnv()

// `@stacksjs/stx`'s reactivity flushes effects through requestAnimationFrame,
// which Bun's non-DOM test runtime does not provide. It schedules through a
// NESTED rAF, so the inner callback lands well after the test that triggered
// it — any suite that installed the shim itself and tore it down afterwards
// left that callback calling a function that no longer existed, surfacing as
// "TypeError: requestAnimationFrame is not a function" between tests. That
// failed the run through bun's exit code while the summary still read 0 fail.
//
// Installed here instead: rAF never exists in this runtime, so there is
// nothing to restore and no window in which it can go missing. Guarded so a
// real DOM environment keeps its own implementation.
if (typeof globalThis.requestAnimationFrame !== 'function') {
  globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) =>
    setTimeout(() => cb(Date.now()), 0) as unknown as number) as typeof requestAnimationFrame

  globalThis.cancelAnimationFrame = ((handle: number) =>
    clearTimeout(handle as unknown as ReturnType<typeof setTimeout>)) as typeof cancelAnimationFrame
}
