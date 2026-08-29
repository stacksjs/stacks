/**
 * The globals the server injects into the page, declared once.
 *
 * Every one of these was read through `(window as any)` or `(globalThis as
 * any)` - six casts across five files - so a typo in a key was a silent
 * `undefined` and the default beside it quietly won. `__STACKS_CONFIG__` is
 * how an application overrides its API base URL and auth endpoints, so a
 * misspelt `AUTH_ME_PATH` looks exactly like not having set one.
 *
 * `composables/auth/useGithub.ts` did carry a `declare global` meant to fix
 * this, but it declared `interface Window {}` - empty, so it merged nothing -
 * under a `@ts-ignore` that hid the fact it was doing nothing at all.
 */
export interface StacksBrowserConfig {
  /** Base URL for API calls. Defaults to the page's own origin. */
  API_URL?: string
  /** Path the auth composable calls to resolve the current user. */
  AUTH_ME_PATH?: string
  /** Path the auth composable calls to refresh a token. */
  AUTH_REFRESH_PATH?: string
  /** Publishable Stripe key for the browser billing helpers. */
  FRONTEND_STRIPE_PUBLIC_KEY?: string
  /** An application may inject its own keys alongside these. */
  [key: string]: unknown
}

declare global {
  // eslint-disable-next-line vars-on-top, no-var
  var __STACKS_CONFIG__: StacksBrowserConfig | undefined
  // eslint-disable-next-line vars-on-top, no-var
  var __STACKS_API_URL__: string | undefined
  // eslint-disable-next-line vars-on-top, no-var
  var __STACKS_LOGIN_URL__: string | undefined
  // eslint-disable-next-line vars-on-top, no-var
  var __STACKS_DEBUG__: boolean | undefined
}

export {}
