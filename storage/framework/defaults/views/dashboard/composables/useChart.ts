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

import type { Chart, ChartConfig, ChartData, ChartDataset, ChartOptions, ChartType } from '@stacksjs/charts'
import { onDestroy, onMount } from '@stacksjs/stx'

export type { ChartConfig, ChartData, ChartDataset, ChartOptions, ChartType }

/**
 * The part of a chart instance this codebase touches, taken from the class
 * rather than restated.
 *
 * `data` is included because every dashboard that refreshes a chart writes
 * through it - replacing `labels` and each dataset's `data`, then calling
 * `update()` - rather than destroying and rebuilding.
 *
 * This used to be a hand-written interface, deliberately not importing
 * `@stacksjs/charts` "to keep this composable dep-free at the type level".
 * The import is type-only and erases, so it costs nothing at runtime, and
 * writing the shape out by hand cost plenty: it omitted `data`, so three
 * dashboards each declared their own local `ChartLike` in three slightly
 * different shapes to get at it, and every page then needed
 * `Chart as unknown as ChartCtor` to get the real constructor past a
 * signature that described it imprecisely.
 */
export type ChartLike = Pick<Chart, 'data' | 'update' | 'destroy'>

/** `new Chart(canvas, config)`, taken from the class itself. */
export type ChartCtor = new (..._args: ConstructorParameters<typeof Chart>) => ChartLike

export interface UseChartOptions {
  /** Chart constructor (`new Chart(...)`). Pages import lazily and pass it in. */
  Chart: ChartCtor
  /** Element id, e.g. `'chart_1'`. */
  id: string
  type: ChartType
  data: ChartData
  options?: ChartOptions
}

export interface ChartHandle {
  /** The constructed chart, or `null` if the element was missing or we're SSR. */
  readonly instance: ChartLike | null
  destroy: () => void
  update: () => void
}

/** A handle that renders nothing, for the cases where there is no canvas to draw on. */
function inertHandle(): ChartHandle {
  return { instance: null, destroy: () => {}, update: () => {} }
}

export function useChart(opts: UseChartOptions): ChartHandle {
  // SSR-safe — no document means no canvas.
  if (typeof document === 'undefined')
    return inertHandle()

  const el = document.getElementById(opts.id)
  if (!el) {
    // Canvas not in the DOM yet (or wrong id). Returning a no-op handle
    // is friendlier than throwing — pages stay rendered, devs see the
    // missing chart and can grep the id.
    // eslint-disable-next-line no-console
    console.warn(`[useChart] no element with id "${opts.id}". Chart not initialised.`)
    return inertHandle()
  }

  // Chart draws on a canvas, and an id that resolves to a `<div>` is the same
  // class of page mistake as an id that resolves to nothing: worth the same
  // warning rather than a stack trace from inside the chart library.
  if (!(el instanceof HTMLCanvasElement)) {
    // eslint-disable-next-line no-console
    console.warn(`[useChart] element with id "${opts.id}" is a <${el.tagName.toLowerCase()}>, not a <canvas>. Chart not initialised.`)
    return inertHandle()
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
