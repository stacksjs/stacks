import type { ChartOptions } from './types'

export interface CanvasSize {
  height: number
  width: number
}

export function resolveCanvasCssSize(
  canvas: CanvasSize,
  container: CanvasSize | undefined,
  options: Pick<ChartOptions, 'maintainAspectRatio' | 'responsive'>,
): CanvasSize {
  if (options.responsive === false || !container || container.width <= 0)
    return canvas

  const width = container.width
  if (options.maintainAspectRatio === false && container.height > 0)
    return { width, height: container.height }

  const aspectRatio = canvas.width > 0 && canvas.height > 0 ? canvas.width / canvas.height : 2
  return { width, height: width / aspectRatio }
}
