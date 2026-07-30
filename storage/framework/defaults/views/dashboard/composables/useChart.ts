/**
 * useChart — wires `@stacksjs/charts` to a canvas without leaking
 * `document.getElementById` into pages.
 *
 * The dashboard repeats the same shape across feature pages:
 *
 *   const ctx = document.getElementById('chart_1')
 *   if (ctx) new Chart(ctx, { type, data, options })
 *
 * `useChart` packages that into one call, returns a destroyer so SPA
 * navigation can tear charts down, and tolerates SSR (no-ops on the
 * server). `useLazyCharts` owns the asynchronous browser import and
 * lifecycle for pages that should defer the chart library.
 */

import { onDestroy, onMount } from '@stacksjs/stx'

export interface ChartLike {
  destroy: () => void
  update?: () => void
}

// Constructor signature mirrors Chart.js — `new Chart(canvas, config)`.
// We don't import `@stacksjs/charts` here to keep this composable
// dep-free at the type level; pages pass the constructor in.
export type ChartCtor = new (
  canvas: HTMLCanvasElement | HTMLElement,
  config: { type: string, data: unknown, options?: unknown },
) => ChartLike

export interface UseChartOptions {
  /** Chart constructor (`new Chart(...)`). Pages import lazily and pass it in. */
  Chart: ChartCtor
  /** Element id, e.g. `'chart_1'`. */
  id: string
  type: string
  data: unknown
  options?: unknown
}

export interface ChartHandle {
  /** The constructed chart, or `null` if the element was missing or we're SSR. */
  readonly instance: ChartLike | null
  destroy: () => void
  update: () => void
}

export function useChart(opts: UseChartOptions): ChartHandle {
  // SSR-safe — no document means no canvas.
  if (typeof document === 'undefined')
    return { instance: null, destroy: () => {}, update: () => {} }

  const el = document.getElementById(opts.id)
  if (!el) {
    // Canvas not in the DOM yet (or wrong id). Returning a no-op handle
    // is friendlier than throwing — pages stay rendered, devs see the
    // missing chart and can grep the id.
    // eslint-disable-next-line no-console
    console.warn(`[useChart] no element with id "${opts.id}". Chart not initialised.`)
    return { instance: null, destroy: () => {}, update: () => {} }
  }

  const instance = new opts.Chart(el, { type: opts.type, data: opts.data, options: opts.options })
  return {
    instance,
    destroy: () => instance.destroy(),
    update: () => instance.update?.(),
  }
}

/**
 * Convenience for the common "init N charts at once" pattern. Returns
 * a single destroyer that tears them all down.
 */
export function useCharts(specs: UseChartOptions[]): { handles: ChartHandle[], destroyAll: () => void, updateAll: () => void } {
  const handles = specs.map(useChart)
  return {
    handles,
    destroyAll: () => handles.forEach(h => h.destroy()),
    updateAll: () => handles.forEach(h => h.update()),
  }
}

export interface LazyChartsHandle {
  readonly handles: ChartHandle[]
  destroyAll: () => void
  updateAll: () => void
}

/**
 * Load chart code only after the component DOM has mounted, then release every
 * chart automatically when SPA navigation destroys the page scope.
 */
export function useLazyCharts(loadSpecs: () => Promise<UseChartOptions[]>): LazyChartsHandle {
  let handles: ChartHandle[] = []
  let active = true

  const destroyAll = (): void => {
    active = false
    handles.forEach(handle => handle.destroy())
    handles = []
  }

  const updateAll = (): void => {
    handles.forEach(handle => handle.update())
  }

  onMount(async () => {
    const specs = await loadSpecs()
    if (!active)
      return

    handles = specs.map(useChart)
  })

  onDestroy(destroyAll)

  return {
    get handles() {
      return handles
    },
    destroyAll,
    updateAll,
  }
}
