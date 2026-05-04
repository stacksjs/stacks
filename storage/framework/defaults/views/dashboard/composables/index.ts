/**
 * Dashboard composables — the only sanctioned way to reach `window.*`
 * or `document.*` from a `.stx` page. See stacksjs/stacks#1838.
 *
 * Add new composables here when a pattern shows up across more than
 * one page; one-off DOM access still belongs in a composable, just
 * scoped to the feature area's directory.
 */

export type { ChartCtor, ChartHandle, ChartLike, UseChartOptions } from './useChart'
export { useChart, useCharts } from './useChart'

export type { UseNavigationApi } from './useNavigation'
export { useNavigation } from './useNavigation'

export type { ThemePreference, UseThemeApi } from './useTheme'
export { useTheme } from './useTheme'
