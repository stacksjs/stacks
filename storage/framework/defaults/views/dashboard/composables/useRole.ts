/**
 * Role-aware visibility hook for dashboard features.
 *
 * **Stub** — the role system itself lives in
 * [stacksjs/stacks#1843](https://github.com/stacksjs/stacks/issues/1843).
 * Until that lands, every caller sees `isDev: true` so the dev-mode
 * dashboard surfaces (CI tracking from #1844, future infra surfaces)
 * render as if the viewer were an admin/dev.
 *
 * Surfaces that should be gated behind the eventual role system call
 * this composable; replacing the body with the real implementation
 * once #1843 ships flips all consumers in one place.
 *
 * Example consumer:
 *
 * ```ts
 * const { isDev } = useRole()
 * const showCiTab = derived(() => isDev())
 * ```
 */
import { state } from '@stacksjs/stx'

export interface RoleSnapshot {
  /** Admin: every dashboard surface is visible. */
  isAdmin: () => boolean
  /** Dev: infra/dev-mode surfaces (CI tracking, runner alerts) are visible. */
  isDev: () => boolean
  /** Client: minimal surface — content / orders / billing only. */
  isClient: () => boolean
}

// Stub returns hardcoded "everyone is a dev" until #1843 ships the real
// role layer. State wrappers keep the API reactive so consumers that
// `derived(() => isDev())` won't have to rewrite their call sites.
const TRUE = state(true)
const FALSE = state(false)

export function useRole(): RoleSnapshot {
  // TODO(#1843): replace with the real role resolution. Should read the
  // authenticated user's role from the auth store / cookie / JWT and
  // expose reactive signals that flip when the user re-authenticates.
  return {
    isAdmin: () => TRUE(),
    isDev: () => TRUE(),
    isClient: () => FALSE(),
  }
}
