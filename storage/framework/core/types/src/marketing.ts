/**
 * **Marketing Options**
 *
 * Top-level feature gate for the marketing bundle (`/api/email/subscribe`,
 * `/api/contact`, Campaign / EmailList / SocialPost). Stays inert at boot
 * when `enabled` is `false`.
 */
export interface MarketingOptions {
  enabled?: boolean
  /** Optional deploy-target gate, e.g. `['production']`. */
  env?: string[]
}

export type MarketingConfig = Partial<MarketingOptions>
