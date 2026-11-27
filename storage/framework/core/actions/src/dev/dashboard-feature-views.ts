type DashboardConfigFeature = 'cms' | 'commerce'

/** Hide configuration editors for optional features the app has not installed. */
export function disabledFeatureConfigs(enabled: (feature: DashboardConfigFeature) => boolean): Set<string> {
  const optionalFeatures: DashboardConfigFeature[] = ['cms', 'commerce']
  return new Set(optionalFeatures.filter(feature => !enabled(feature)))
}
