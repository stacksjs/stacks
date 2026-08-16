import type { SiteContext } from './types'

/**
 * The shape the stx serving layer stashes on the request-context snapshot
 * (`RequestContextSnapshot.site` in `@stacksjs/config`), which is how
 * `<script server>` blocks see the site - ALS does not survive into
 * stx-serve's render, so this is the one channel that works there.
 */
export interface SiteSnapshotShape {
  id: number
  uuid?: string
  name?: string
  subdomain?: string
  settings?: Record<string, unknown>
}

export function toSiteSnapshot(site: SiteContext | null | undefined): SiteSnapshotShape | null {
  if (!site)
    return null

  return {
    id: site.id,
    uuid: site.uuid,
    name: site.name,
    subdomain: site.subdomain,
    settings: site.settings,
  }
}
