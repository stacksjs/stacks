/**
 * **Stacks Feature Bundles**
 *
 * Each named feature in this manifest is a framework bundle (a set of
 * models, routes, actions, and views) that gets registered at boot only
 * when its flag is `true`. Apps that don't need Commerce/CMS/Monitoring
 * leave those flags `false` (or omitted) and pay nothing for them at boot.
 *
 * Add/remove via `./buddy <feature>:install` / `./buddy <feature>:uninstall`
 * rather than editing the config file directly. The install commands flip
 * the flag, run any feature-specific migrations, and copy starter files.
 *
 * Inspired by Laravel's `php artisan passport:install` / `horizon:install`
 * pattern — features are inert dead code on disk until you install them.
 *
 * Each flag accepts either:
 *   - `true` / `false` — simple on/off
 *   - `{ enabled: true, env: ['production'] }` — gate to specific deploy
 *     targets (compared against `config.app.env`)
 */
export interface FeaturesConfig {
  /** Always activated. Defines the User model and base auth tables. */
  core?: FeatureFlag
  /** Token + password-reset + email-verification flows. */
  auth?: FeatureFlag
  /** `/api/email/subscribe`, `/api/contact`, basic SEO routes. */
  marketing?: FeatureFlag
  /** Post / Page / Author / Comment / Tag / Category + edit dashboard. */
  cms?: FeatureFlag
  /** Order, Cart, Product, Customer, Coupon, GiftCard, Receipt, Shipping. */
  commerce?: FeatureFlag
  /** Admin SPA shell + Activity / Log / Request / Notification dashboards. */
  dashboard?: FeatureFlag
  /** Error monitoring views/actions (subset of dashboard, usable alone). */
  monitoring?: FeatureFlag
  /** WebSocket broadcasting + Websocket model + realtime stats actions. */
  realtime?: FeatureFlag
  /** Job queue runtime + FailedJob model + Job dashboard pages. */
  queue?: FeatureFlag

  /**
   * Apps can also declare custom feature flags here and check them with
   * `feature('my-flag')` from `@stacksjs/config`.
   */
  [name: string]: FeatureFlag | undefined
}

export type FeatureFlag = boolean | { enabled?: boolean, env?: string[] }

/**
 * The full set of framework-bundled features. Install commands type-check
 * against this union so a typo like `commerse` fails at compile time.
 */
export type StacksFeature =
  | 'core' | 'auth' | 'marketing' | 'cms' | 'commerce'
  | 'dashboard' | 'monitoring' | 'realtime' | 'queue'
