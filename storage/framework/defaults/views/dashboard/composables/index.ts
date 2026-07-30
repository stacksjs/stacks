/**
 * Dashboard-local composables.
 *
 * Most reactive primitives are auto-imported by stx in `<script client>`
 * blocks (`state`, `derived`, `effect`, `onMount`, `onDestroy`, `navigate`,
 * `goBack`, `useColorMode`, `useDark`, `useFetch`, `useEventListener`, …) —
 * reach for those first. This barrel only ships things stx doesn't.
 *
 * See stacksjs/stacks#1838 for the wider sweep this is part of.
 */

export type {
  AppearancePreferences,
  AppearanceSnapshot,
  ColorMode,
  SidebarStyle,
  SidebarStyleOption,
} from './useAppearance'
export {
  appearanceStore,
  APPEARANCE_STORAGE_KEY,
  applyAppearance,
  COLOR_MODE_OPTIONS,
  DEFAULT_APPEARANCE,
  isColorMode,
  isSidebarStyle,
  normalizeAppearance,
  readStoredAppearance,
  SIDEBAR_STYLE_OPTIONS,
  sidebarThemeFor,
  useAppearance,
} from './useAppearance'
export type { ChartCtor, ChartHandle, ChartLike, LazyChartsHandle, UseChartOptions } from './useChart'
export { useChart, useCharts, useLazyCharts } from './useChart'
export type { NavigationSnapshot } from './useNavigation'
export { useNavigation } from './useNavigation'
export type { RoleSnapshot } from './useRole'
export { useRole } from './useRole'
export type { ThemeMode, ThemeSnapshot } from './useTheme'
export { isDarkTheme, useTheme } from './useTheme'
