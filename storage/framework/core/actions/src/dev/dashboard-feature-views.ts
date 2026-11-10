import { join } from 'node:path'

/**
 * The framework dashboard pages that belong to an optional feature, relative
 * to the framework's `views/dashboard` directory.
 *
 * A feature that is off is off everywhere: its sidebar section, its routes and
 * its tables already follow `feature()`, and so do these. Without them a page
 * like `/commerce/orders` was hidden from the sidebar yet still answered its
 * URL, drawing a full screen of 404s from the API routes the same flag had left
 * unmounted. Excluded, the URL falls through to the dashboard's not-found page.
 *
 * Only the framework's pages are listed. A page an app wrote itself under
 * `resources/views/dashboard/` is the app saying it wants that page, so it is
 * served whatever the flag says.
 *
 * `marketing/abandoned-carts` and `marketing/reviews` read the commerce tables,
 * which is why the sidebar shows them only with commerce on.
 */
export const FEATURE_DASHBOARD_VIEWS = {
  cms: ['content'],
  commerce: ['commerce', 'analytics/commerce', 'marketing/abandoned-carts', 'marketing/reviews'],
} as const

export type DashboardViewFeature = keyof typeof FEATURE_DASHBOARD_VIEWS

/** The page directories under `frameworkDashboard` to leave out of serving. */
export function disabledFeatureViews(
  frameworkDashboard: string,
  enabled: (feature: DashboardViewFeature) => boolean,
): string[] {
  const out: string[] = []
  for (const feature of Object.keys(FEATURE_DASHBOARD_VIEWS) as DashboardViewFeature[]) {
    if (enabled(feature))
      continue
    for (const relative of FEATURE_DASHBOARD_VIEWS[feature])
      out.push(join(frameworkDashboard, relative))
  }
  return out
}
