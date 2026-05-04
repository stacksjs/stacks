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

export type { ChartCtor, ChartHandle, ChartLike, UseChartOptions } from './useChart'
export { useChart, useCharts } from './useChart'
