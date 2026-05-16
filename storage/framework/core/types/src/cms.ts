/**
 * **CMS Options**
 *
 * Top-level feature gate plus any future CMS-wide settings. The CMS bundle
 * (Post / Page / Author / Comment / Tag / Category models + edit dashboards)
 * stays inert at boot when `enabled` is `false`.
 */
export interface CmsOptions {
  enabled?: boolean
  /** Optional deploy-target gate, e.g. `['production']`. */
  env?: string[]
}

export type CmsConfig = Partial<CmsOptions>
