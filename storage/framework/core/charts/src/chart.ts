import type { ChartConfig, ChartData, ChartDataset, ChartOptions, ChartType, TooltipCallbackContext } from './types'
import { scaleBand, scaleLinear } from '@ts-charts/scale'
import {
  arc as d3Arc,
  area as d3Area,
  curveLinear,
  curveMonotoneX,
  line as d3Line,
  pie as d3Pie,
} from '@ts-charts/shape'
import { paletteColor, withAlpha } from './colors'
import { formatTick, niceTicks } from './ticks'

interface Box {
  x: number
  y: number
  w: number
  h: number
}

interface AxisLayout {
  ticks: number[]
  min: number
  max: number
}

interface HitItem {
  datasetIndex: number
  dataIndex: number
  x: number
  y: number
  label: string
  value: number
}

const DEFAULT_GRID_COLOR = 'rgba(148, 163, 184, 0.18)'
const DEFAULT_TEXT_COLOR = '#64748b'
const DEFAULT_BG = 'rgba(15, 23, 42, 0.92)'

/**
 * Chart.js-compatible adapter rendering to HTML5 Canvas.
 *
 * Supports the dashboard subset: line / bar / doughnut / pie, with
 * responsive sizing, scales (beginAtZero / stacked / grid / ticks /
 * y1 dual-axis), legends, and tooltip callbacks. Advanced features
 * (radar, animations, plugins) are no-ops rather than crashes.
 */
export class Chart {
  static instances = new WeakMap<HTMLCanvasElement, Chart>()

  /**
   * Compatibility no-op: chart.js requires `Chart.register(...registerables)`
   * before usage. We auto-register everything, so this is intentionally inert.
   */
  static register(..._items: unknown[]): void {
    // no-op
  }

  type: ChartType
  data: ChartData
  options: ChartOptions
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D

  private resizeObserver: ResizeObserver | null = null
  private hitItems: HitItem[] = []
  private tooltipEl: HTMLDivElement | null = null
  private boundMove = (e: MouseEvent) => this.handleMouseMove(e)
  private boundLeave = () => this.hideTooltip()

  constructor(target: HTMLCanvasElement | CanvasRenderingContext2D, config: ChartConfig) {
    this.canvas = target instanceof HTMLCanvasElement ? target : target.canvas
    const ctx = this.canvas.getContext('2d')
    if (!ctx)
      throw new Error('Chart: 2D canvas context unavailable')
    this.ctx = ctx
    this.type = config.type
    this.data = config.data
    this.options = config.options ?? {}

    Chart.instances.set(this.canvas, this)
    this.attachInteractions()
    this.observeResize()
    this.render()
  }

  update(): void {
    this.render()
  }

  resize(): void {
    this.render()
  }

  destroy(): void {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect()
      this.resizeObserver = null
    }
    this.canvas.removeEventListener('mousemove', this.boundMove)
    this.canvas.removeEventListener('mouseleave', this.boundLeave)
    if (this.tooltipEl?.parentNode)
      this.tooltipEl.parentNode.removeChild(this.tooltipEl)
    this.tooltipEl = null
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    Chart.instances.delete(this.canvas)
  }

  // ---------- internal ---------- //

  private observeResize(): void {
    if (this.options.responsive === false || typeof ResizeObserver === 'undefined')
      return
    this.resizeObserver = new ResizeObserver(() => this.render())
    this.resizeObserver.observe(this.canvas.parentElement ?? this.canvas)
  }

  private attachInteractions(): void {
    if (this.options.plugins?.tooltip?.enabled === false)
      return
    this.canvas.addEventListener('mousemove', this.boundMove)
    this.canvas.addEventListener('mouseleave', this.boundLeave)
  }

  private syncCanvasSize(): { width: number, height: number } {
    const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1
    const rect = this.canvas.getBoundingClientRect()
    const cssW = rect.width || this.canvas.clientWidth || this.canvas.width
    const cssH = rect.height || this.canvas.clientHeight || this.canvas.height
    const w = Math.max(1, Math.floor(cssW * dpr))
    const h = Math.max(1, Math.floor(cssH * dpr))
    if (this.canvas.width !== w)
      this.canvas.width = w
    if (this.canvas.height !== h)
      this.canvas.height = h
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    return { width: cssW, height: cssH }
  }

  private render(): void {
    const { width, height } = this.syncCanvasSize()
    this.ctx.clearRect(0, 0, width, height)
    this.hitItems = []

    if (this.type === 'doughnut' || this.type === 'pie') {
      this.renderRadial(width, height)
      return
    }

    if (this.type === 'radar') {
      // Best-effort: fall back to a simple line chart layout for now.
      this.renderCartesian(width, height, 'line')
      return
    }

    this.renderCartesian(width, height, this.type)
  }

  // ---------- cartesian (line/bar) ---------- //

  private renderCartesian(width: number, height: number, type: ChartType): void {
    const labels = this.data.labels ?? []
    const datasets = this.data.datasets

    const legend = this.layoutLegend(width, height)
    const titleH = this.options.plugins?.title?.display ? 24 : 0
    const padTop = 8 + titleH + (legend.position === 'top' ? legend.h : 0)
    const padBottom = 28 + (legend.position === 'bottom' ? legend.h : 0)
    const padLeft = 48 + (legend.position === 'left' ? legend.w : 0)
    const padRight = 16 + (legend.position === 'right' ? legend.w : 0) + (this.hasRightAxis() ? 40 : 0)

    const plot: Box = {
      x: padLeft,
      y: padTop,
      w: Math.max(1, width - padLeft - padRight),
      h: Math.max(1, height - padTop - padBottom),
    }

    if (this.options.plugins?.title?.display && this.options.plugins.title.text) {
      const t = this.options.plugins.title
      this.ctx.fillStyle = t.color ?? DEFAULT_TEXT_COLOR
      this.ctx.font = `${t.font?.size ?? 14}px system-ui, sans-serif`
      this.ctx.textAlign = 'center'
      this.ctx.textBaseline = 'top'
      this.ctx.fillText(t.text ?? '', width / 2, 8)
    }

    this.drawLegend(legend, datasets)

    const yAxis = this.computeAxis(datasets.filter(d => (d.yAxisID ?? 'y') === 'y'), 'y')
    const yAxis1 = this.hasRightAxis() ? this.computeAxis(datasets.filter(d => d.yAxisID === 'y1'), 'y1') : null

    this.drawGridAndYAxis(plot, yAxis, 'left')
    if (yAxis1)
      this.drawYAxis(plot, yAxis1, 'right')
    this.drawXAxis(plot, labels)

    if (type === 'bar')
      this.drawBars(plot, labels, datasets, yAxis, yAxis1)
    else this.drawLines(plot, labels, datasets, yAxis, yAxis1)
  }

  private hasRightAxis(): boolean {
    return this.data.datasets.some(d => d.yAxisID === 'y1')
  }

  private computeAxis(datasets: ChartDataset[], axisId: string): AxisLayout {
    const cfg = this.options.scales?.[axisId] ?? {}
    let min = Number.POSITIVE_INFINITY
    let max = Number.NEGATIVE_INFINITY

    if (cfg.stacked) {
      const labels = this.data.labels ?? []
      for (let i = 0; i < labels.length; i++) {
        let pos = 0
        let neg = 0
        for (const ds of datasets) {
          const v = ds.data[i] ?? 0
          if (v >= 0)
            pos += v
          else neg += v
        }
        if (pos > max)
          max = pos
        if (neg < min)
          min = neg
      }
    }
    else {
      for (const ds of datasets) {
        for (const v of ds.data) {
          if (v < min)
            min = v
          if (v > max)
            max = v
        }
      }
    }

    if (!Number.isFinite(min))
      min = 0
    if (!Number.isFinite(max))
      max = 1
    if (cfg.beginAtZero !== false && min > 0)
      min = 0
    if (cfg.min !== undefined)
      min = cfg.min
    if (cfg.max !== undefined)
      max = cfg.max
    if (min === max) {
      max = min + 1
    }

    const ticks = niceTicks(min, max, cfg.ticks?.maxTicksLimit ?? 6)
    // niceTicks always returns at least one element, but the type
    // system can't see that — fall back to the resolved domain so
    // downstream consumers always get concrete numbers.
    return { ticks, min: ticks[0] ?? min, max: ticks[ticks.length - 1] ?? max }
  }

  private drawGridAndYAxis(plot: Box, axis: AxisLayout, side: 'left' | 'right'): void {
    const cfg = this.options.scales?.y ?? {}
    const showGrid = cfg.grid?.display !== false
    const tickColor = cfg.ticks?.color ?? DEFAULT_TEXT_COLOR
    const gridColor = cfg.grid?.color ?? DEFAULT_GRID_COLOR

    this.ctx.save()
    this.ctx.font = `${cfg.ticks?.font?.size ?? 11}px system-ui, sans-serif`
    this.ctx.textBaseline = 'middle'

    for (const tick of axis.ticks) {
      const y = this.scaleY(plot, axis, tick)
      if (showGrid) {
        this.ctx.strokeStyle = gridColor
        this.ctx.lineWidth = 1
        this.ctx.beginPath()
        this.ctx.moveTo(plot.x, y)
        this.ctx.lineTo(plot.x + plot.w, y)
        this.ctx.stroke()
      }
      const label = cfg.ticks?.callback
        ? cfg.ticks.callback(tick, axis.ticks.indexOf(tick), axis.ticks)
        : formatTick(tick)
      this.ctx.fillStyle = tickColor
      this.ctx.textAlign = side === 'left' ? 'right' : 'left'
      const tx = side === 'left' ? plot.x - 8 : plot.x + plot.w + 8
      this.ctx.fillText(String(label), tx, y)
    }
    this.ctx.restore()
  }

  private drawYAxis(plot: Box, axis: AxisLayout, side: 'left' | 'right'): void {
    const cfg = this.options.scales?.y1 ?? {}
    const tickColor = cfg.ticks?.color ?? DEFAULT_TEXT_COLOR
    this.ctx.save()
    this.ctx.font = `${cfg.ticks?.font?.size ?? 11}px system-ui, sans-serif`
    this.ctx.textBaseline = 'middle'
    for (const tick of axis.ticks) {
      const y = this.scaleY(plot, axis, tick)
      const label = cfg.ticks?.callback
        ? cfg.ticks.callback(tick, axis.ticks.indexOf(tick), axis.ticks)
        : formatTick(tick)
      this.ctx.fillStyle = tickColor
      this.ctx.textAlign = side === 'left' ? 'right' : 'left'
      const tx = side === 'left' ? plot.x - 8 : plot.x + plot.w + 8
      this.ctx.fillText(String(label), tx, y)
    }
    this.ctx.restore()
  }

  private drawXAxis(plot: Box, labels: string[]): void {
    const cfg = this.options.scales?.x ?? {}
    const tickColor = cfg.ticks?.color ?? DEFAULT_TEXT_COLOR
    if (cfg.display === false || labels.length === 0)
      return

    this.ctx.save()
    this.ctx.font = `${cfg.ticks?.font?.size ?? 11}px system-ui, sans-serif`
    this.ctx.textBaseline = 'top'
    this.ctx.textAlign = 'center'
    this.ctx.fillStyle = tickColor

    const maxLabels = Math.min(labels.length, Math.max(2, Math.floor(plot.w / 60)))
    const step = Math.max(1, Math.floor(labels.length / maxLabels))

    for (let i = 0; i < labels.length; i += step) {
      const x = this.scaleX(plot, labels.length, i)
      this.ctx.fillText(labels[i] ?? '', x, plot.y + plot.h + 8)
    }
    this.ctx.restore()
  }

  /**
   * X-axis pixel mapping. We delegate the math to `@ts-charts/scale`'s
   * `scaleLinear` so categorical points distribute evenly across the plot
   * the same way d3-scale would, including the degenerate single-point
   * case (collapses to plot center).
   */
  private scaleX(plot: Box, count: number, i: number): number {
    if (count <= 1)
      return plot.x + plot.w / 2
    const s = scaleLinear().domain([0, count - 1]).range([plot.x, plot.x + plot.w])
    return s(i)
  }

  /**
   * Y-axis pixel mapping built on `@ts-charts/scale`'s `scaleLinear`.
   * Inverts the canvas Y axis by giving the larger pixel value to the
   * smaller domain value, so the visual direction matches an SVG plot.
   */
  private scaleY(plot: Box, axis: AxisLayout, value: number): number {
    if (axis.max === axis.min)
      return plot.y + plot.h / 2
    const s = scaleLinear().domain([axis.min, axis.max]).range([plot.y + plot.h, plot.y])
    return s(value)
  }

  private drawLines(plot: Box, labels: string[], datasets: ChartDataset[], yAxis: AxisLayout, yAxis1: AxisLayout | null): void {
    datasets.forEach((ds, idx) => {
      const axis = ds.yAxisID === 'y1' && yAxis1 ? yAxis1 : yAxis
      if (ds.type === 'bar') {
        this.drawBarSeries(plot, labels, [ds], yAxis, yAxis1)
        return
      }

      const color = (typeof ds.borderColor === 'string' ? ds.borderColor : null) ?? paletteColor(idx)
      const fillColor = ds.backgroundColor && typeof ds.backgroundColor === 'string'
        ? ds.backgroundColor
        : ds.fill ? withAlpha(color, 0.15) : null

      const points: Array<{ x: number, y: number, value: number }> = ds.data.map((v, i) => ({
        x: this.scaleX(plot, labels.length || ds.data.length, i),
        y: this.scaleY(plot, axis, v),
        value: v,
      }))

      if (points.length === 0)
        return

      // Chart.js's `tension` field controls smoothing. We map any
      // non-zero tension to d3-shape's `curveMonotoneX`, which is
      // visually closer to the Chart.js look than `curveCardinal`
      // and never overshoots, so axis grids stay tight.
      const curve = (ds.tension ?? 0) > 0 ? curveMonotoneX : curveLinear

      // Filled area under the line (Chart.js semantic: `fill: true`
      // floods between the line and the x-axis baseline).
      if (fillColor) {
        const baseline = plot.y + plot.h
        const areaGen = (d3Area() as any)
          .x((p: { x: number }) => p.x)
          .y0(() => baseline)
          .y1((p: { y: number }) => p.y)
          .curve(curve)
          .context(this.ctx)
        this.ctx.beginPath()
        areaGen(points)
        this.ctx.fillStyle = fillColor
        this.ctx.fill()
        areaGen.context(null)
      }

      // Line stroke through the same point set.
      const lineGen = (d3Line() as any)
        .x((p: { x: number }) => p.x)
        .y((p: { y: number }) => p.y)
        .curve(curve)
        .context(this.ctx)
      this.ctx.beginPath()
      lineGen(points)
      this.ctx.lineWidth = ds.borderWidth ?? 2
      this.ctx.strokeStyle = color
      this.ctx.lineJoin = 'round'
      this.ctx.lineCap = 'round'
      this.ctx.stroke()
      lineGen.context(null)

      const r = ds.pointRadius ?? 0
      if (r > 0) {
        this.ctx.fillStyle = ds.pointBackgroundColor ?? color
        for (const p of points) {
          this.ctx.beginPath()
          this.ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
          this.ctx.fill()
        }
      }

      points.forEach((p, i) => {
        this.hitItems.push({
          datasetIndex: idx,
          dataIndex: i,
          x: p.x,
          y: p.y,
          label: labels[i] ?? String(i),
          value: p.value,
        })
      })
    })
  }

  private drawBars(plot: Box, labels: string[], datasets: ChartDataset[], yAxis: AxisLayout, yAxis1: AxisLayout | null): void {
    this.drawBarSeries(plot, labels, datasets, yAxis, yAxis1)
  }

  private drawBarSeries(plot: Box, labels: string[], datasets: ChartDataset[], yAxis: AxisLayout, yAxis1: AxisLayout | null): void {
    const count = labels.length || (datasets[0]?.data.length ?? 0)
    if (count === 0)
      return

    const cfg = this.options.scales?.y
    const stacked = !!cfg?.stacked

    // Use `@ts-charts/scale`'s `scaleBand` to compute the per-category
    // band so the bar group width and gutter respect the same 0.3
    // padding ratio d3-scale uses by default. Each band is then split
    // among datasets in unstacked mode.
    const indices = Array.from({ length: count }, (_, i) => i)
    const xBand = scaleBand().domain(indices).range([plot.x, plot.x + plot.w]).paddingInner(0.3)
    const groupWidth = xBand.bandwidth() as number
    const barWidth = stacked ? groupWidth : groupWidth / Math.max(1, datasets.length)

    for (let i = 0; i < count; i++) {
      const cx = xBand(i) as number
      let posStack = 0
      let negStack = 0

      datasets.forEach((ds, dsIdx) => {
        const axis = ds.yAxisID === 'y1' && yAxis1 ? yAxis1 : yAxis
        const value = ds.data[i] ?? 0
        const baseValue = stacked ? (value >= 0 ? posStack : negStack) : 0
        const topValue = baseValue + value

        const yBase = this.scaleY(plot, axis, baseValue)
        const yTop = this.scaleY(plot, axis, topValue)
        const x = stacked ? cx : cx + dsIdx * barWidth
        const y = Math.min(yBase, yTop)
        const h = Math.abs(yTop - yBase)

        const color = Array.isArray(ds.backgroundColor)
          ? ds.backgroundColor[i] ?? paletteColor(dsIdx)
          : (typeof ds.backgroundColor === 'string' ? ds.backgroundColor : paletteColor(dsIdx))
        this.ctx.fillStyle = color
        this.ctx.fillRect(x, y, Math.max(1, barWidth - 2), h)

        if (ds.borderWidth && ds.borderColor && typeof ds.borderColor === 'string') {
          this.ctx.lineWidth = ds.borderWidth
          this.ctx.strokeStyle = ds.borderColor
          this.ctx.strokeRect(x, y, Math.max(1, barWidth - 2), h)
        }

        if (stacked) {
          if (value >= 0)
            posStack = topValue
          else negStack = topValue
        }

        this.hitItems.push({
          datasetIndex: dsIdx,
          dataIndex: i,
          x: x + barWidth / 2,
          y,
          label: labels[i] ?? String(i),
          value,
        })
      })
    }
  }

  // ---------- radial (pie/doughnut) ---------- //

  private renderRadial(width: number, height: number): void {
    const datasets = this.data.datasets
    if (datasets.length === 0)
      return

    const ds = datasets[0]
    if (!ds)
      return
    const labels = this.data.labels ?? []

    const legend = this.layoutLegend(width, height)
    let plotW = width
    let plotH = height
    let offsetX = 0
    let offsetY = 0
    if (legend.position === 'right') {
      plotW = width - legend.w
    }
    else if (legend.position === 'left') {
      plotW = width - legend.w
      offsetX = legend.w
    }
    else if (legend.position === 'top') {
      plotH = height - legend.h
      offsetY = legend.h
    }
    else if (legend.position === 'bottom') {
      plotH = height - legend.h
    }

    this.drawLegend(legend, datasets.map((d, i): ChartDataset => ({
      ...d,
      label: labels[i] ?? d.label,
    })), labels)

    const cx = offsetX + plotW / 2
    const cy = offsetY + plotH / 2
    const radius = Math.min(plotW, plotH) / 2 - 8
    const cutoutRaw = this.options.cutout
    const cutoutPct = typeof cutoutRaw === 'string' && cutoutRaw.endsWith('%')
      ? Number.parseFloat(cutoutRaw) / 100
      : (this.type === 'doughnut' ? 0.6 : 0)
    const inner = radius * cutoutPct

    // Layout each slice via d3-shape's `pie()` generator (from
    // `@ts-charts/shape`). The generator handles ordering, value
    // normalisation, and the start/end angle math we used to inline.
    // We then render with `arc()` against the canvas context so the
    // existing canvas-only API stays unchanged from the caller's POV.
    const pieLayout = (d3Pie() as any)
      .value((d: number) => Math.max(0, d || 0))
      .startAngle(-Math.PI / 2)
      .endAngle(-Math.PI / 2 + Math.PI * 2)
      .sort(null)
    const slices = pieLayout(ds.data) as Array<{ startAngle: number, endAngle: number, value: number, index: number }>

    const slicePath = (d3Arc() as any)
      .innerRadius(inner)
      .outerRadius(radius)

    this.ctx.save()
    this.ctx.translate(cx, cy)
    for (const s of slices) {
      const i = s.index
      const value = ds.data[i] ?? 0
      const color = Array.isArray(ds.backgroundColor)
        ? ds.backgroundColor[i] ?? paletteColor(i)
        : (typeof ds.backgroundColor === 'string' ? ds.backgroundColor : paletteColor(i))

      this.ctx.beginPath()
      slicePath.context(this.ctx)(s)
      this.ctx.fillStyle = color
      this.ctx.fill()

      const mid = (s.startAngle + s.endAngle) / 2 - Math.PI / 2
      const hitR = (radius + inner) / 2
      this.hitItems.push({
        datasetIndex: 0,
        dataIndex: i,
        x: cx + Math.cos(mid) * hitR,
        y: cy + Math.sin(mid) * hitR,
        label: labels[i] ?? String(i),
        value,
      })
    }
    this.ctx.restore()
    // Reset the path's bound context so the generator instance doesn't
    // hold a reference to a destroyed canvas across re-renders.
    slicePath.context(null)
  }

  // ---------- legend ---------- //

  private layoutLegend(width: number, _height: number): { w: number, h: number, position: 'top' | 'right' | 'bottom' | 'left' | 'none' } {
    const cfg = this.options.plugins?.legend
    if (cfg?.display === false || !this.data.datasets.some(d => d.label))
      return { w: 0, h: 0, position: 'none' }
    const position = cfg?.position ?? 'top'
    if (position === 'left' || position === 'right')
      return { w: 100, h: 0, position }
    return { w: 0, h: Math.max(24, Math.ceil(this.data.datasets.length / 4) * 18 + 8), position }
  }

  private drawLegend(legend: ReturnType<Chart['layoutLegend']>, datasets: ChartDataset[], labels?: string[]): void {
    if (legend.position === 'none')
      return
    const cfg = this.options.plugins?.legend
    const items = labels && (this.type === 'pie' || this.type === 'doughnut')
      ? labels.map((label, i): { label: string, color: string } => {
          const ds = datasets[0]
          const color = Array.isArray(ds?.backgroundColor)
            ? ds.backgroundColor[i] ?? paletteColor(i)
            : (typeof ds?.backgroundColor === 'string' ? ds.backgroundColor : paletteColor(i))
          return { label, color }
        })
      : datasets.map((ds, i): { label: string, color: string } => ({
          label: ds.label ?? `Dataset ${i + 1}`,
          color: typeof ds.borderColor === 'string'
            ? ds.borderColor
            : Array.isArray(ds.backgroundColor)
              ? (ds.backgroundColor[0] ?? paletteColor(i))
              : (typeof ds.backgroundColor === 'string' ? ds.backgroundColor : paletteColor(i)),
        }))

    if (items.length === 0)
      return

    this.ctx.save()
    this.ctx.font = `${cfg?.labels?.font?.size ?? 12}px system-ui, sans-serif`
    this.ctx.fillStyle = cfg?.labels?.color ?? DEFAULT_TEXT_COLOR
    this.ctx.textBaseline = 'middle'

    const boxW = cfg?.labels?.boxWidth ?? 12
    const padding = cfg?.labels?.padding ?? 8

    if (legend.position === 'top' || legend.position === 'bottom') {
      const y = legend.position === 'top' ? 12 : (this.canvas.clientHeight || 0) - 12
      let x = padding
      this.ctx.textAlign = 'left'
      for (const it of items) {
        this.ctx.fillStyle = it.color
        this.ctx.fillRect(x, y - boxW / 2, boxW, boxW)
        x += boxW + 4
        this.ctx.fillStyle = cfg?.labels?.color ?? DEFAULT_TEXT_COLOR
        this.ctx.fillText(it.label, x, y)
        x += this.ctx.measureText(it.label).width + padding * 2
      }
    }
    else {
      const x = legend.position === 'right' ? (this.canvas.clientWidth || 0) - 110 : 8
      let y = padding + 6
      for (const it of items) {
        this.ctx.fillStyle = it.color
        this.ctx.fillRect(x, y - boxW / 2, boxW, boxW)
        this.ctx.fillStyle = cfg?.labels?.color ?? DEFAULT_TEXT_COLOR
        this.ctx.textAlign = 'left'
        this.ctx.fillText(it.label, x + boxW + 4, y)
        y += 18
      }
    }
    this.ctx.restore()
  }

  // ---------- tooltip ---------- //

  private handleMouseMove(event: MouseEvent): void {
    if (this.hitItems.length === 0)
      return
    const rect = this.canvas.getBoundingClientRect()
    const mx = event.clientX - rect.left
    const my = event.clientY - rect.top

    const mode = this.options.interaction?.mode ?? this.options.plugins?.tooltip?.mode ?? 'nearest'

    if (mode === 'index') {
      const closest = this.findClosestByIndex(mx)
      if (closest)
        this.showTooltip(event.clientX, event.clientY, closest)
      else this.hideTooltip()
      return
    }

    let nearest: HitItem | null = null
    let bestDist = Number.POSITIVE_INFINITY
    for (const h of this.hitItems) {
      const dx = h.x - mx
      const dy = h.y - my
      const dist = dx * dx + dy * dy
      if (dist < bestDist) {
        bestDist = dist
        nearest = h
      }
    }
    if (nearest && bestDist < 60 * 60)
      this.showTooltip(event.clientX, event.clientY, [nearest])
    else this.hideTooltip()
  }

  private findClosestByIndex(mx: number): HitItem[] | null {
    let bestIndex = -1
    let bestDist = Number.POSITIVE_INFINITY
    for (const h of this.hitItems) {
      const dist = Math.abs(h.x - mx)
      if (dist < bestDist) {
        bestDist = dist
        bestIndex = h.dataIndex
      }
    }
    if (bestIndex < 0)
      return null
    return this.hitItems.filter(h => h.dataIndex === bestIndex)
  }

  private showTooltip(clientX: number, clientY: number, items: HitItem[]): void {
    if (!this.tooltipEl) {
      this.tooltipEl = document.createElement('div')
      Object.assign(this.tooltipEl.style, {
        position: 'fixed',
        pointerEvents: 'none',
        background: this.options.plugins?.tooltip?.backgroundColor ?? DEFAULT_BG,
        color: this.options.plugins?.tooltip?.bodyColor ?? '#fff',
        padding: '6px 10px',
        borderRadius: '6px',
        font: '12px system-ui, sans-serif',
        zIndex: '9999',
        whiteSpace: 'pre-line',
        transform: 'translate(8px, 8px)',
      })
      document.body.appendChild(this.tooltipEl)
    }

    const cb = this.options.plugins?.tooltip?.callbacks
    const lines: string[] = []
    items.forEach((it) => {
      const ds = this.data.datasets[it.datasetIndex]
      if (!ds) return
      const ctx: TooltipCallbackContext = {
        dataset: ds,
        datasetIndex: it.datasetIndex,
        dataIndex: it.dataIndex,
        parsed: { y: it.value },
        raw: it.value,
        label: it.label,
        formattedValue: formatTick(it.value),
      }
      const labelOut = cb?.label ? cb.label(ctx) : `${ds.label ?? ''}: ${formatTick(it.value)}`
      const text = Array.isArray(labelOut) ? labelOut.join('\n') : labelOut
      lines.push(text)
    })

    const titleOut = cb?.title
      ? cb.title(items.flatMap((it) => {
          const ds = this.data.datasets[it.datasetIndex]
          if (!ds) return []
          return [{
            dataset: ds,
            datasetIndex: it.datasetIndex,
            dataIndex: it.dataIndex,
            parsed: { y: it.value },
            raw: it.value,
            label: it.label,
            formattedValue: formatTick(it.value),
          }]
        }))
      : items[0]?.label
    const titleText = Array.isArray(titleOut) ? titleOut.join('\n') : titleOut

    this.tooltipEl.textContent = ''
    if (titleText) {
      const t = document.createElement('strong')
      t.textContent = titleText
      this.tooltipEl.appendChild(t)
      this.tooltipEl.appendChild(document.createElement('br'))
    }
    const body = document.createTextNode(lines.join('\n'))
    this.tooltipEl.appendChild(body)
    this.tooltipEl.style.left = `${clientX}px`
    this.tooltipEl.style.top = `${clientY}px`
    this.tooltipEl.style.display = 'block'
  }

  private hideTooltip(): void {
    if (this.tooltipEl)
      this.tooltipEl.style.display = 'none'
  }
}
