import { describe, expect, it } from 'bun:test'
import { resolveCanvasCssSize } from '../src/sizing'

describe('responsive canvas sizing', () => {
  it('fills both container dimensions when aspect ratio maintenance is disabled', () => {
    expect(resolveCanvasCssSize(
      { width: 300, height: 150 },
      { width: 960, height: 256 },
      { responsive: true, maintainAspectRatio: false },
    )).toEqual({ width: 960, height: 256 })
  })

  it('fills the container width while preserving the canvas aspect ratio by default', () => {
    expect(resolveCanvasCssSize(
      { width: 300, height: 150 },
      { width: 960, height: 256 },
      { responsive: true },
    )).toEqual({ width: 960, height: 480 })
  })

  it('preserves explicit canvas dimensions when responsiveness is disabled', () => {
    expect(resolveCanvasCssSize(
      { width: 640, height: 320 },
      { width: 960, height: 256 },
      { responsive: false },
    )).toEqual({ width: 640, height: 320 })
  })
})
