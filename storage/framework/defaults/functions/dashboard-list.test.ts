import { describe, expect, it } from 'bun:test'
import { pageControls } from './dashboard-list'

/** The smallest thing with the two members `pageControls` reads. */
function pageSignal(initial: number) {
  let value = initial
  const signal = (() => value) as { (): number, set: (next: number) => void }
  signal.set = (next: number) => { value = next }
  return signal
}

describe('pageControls', () => {
  it('moves a page back and forward', () => {
    const page = pageSignal(2)
    const { previousPage, nextPage } = pageControls(page, () => 5)
    previousPage()
    expect(page()).toBe(1)
    nextPage()
    nextPage()
    expect(page()).toBe(3)
  })

  it('will not go below the first page', () => {
    const page = pageSignal(1)
    const { previousPage } = pageControls(page, () => 5)
    previousPage()
    previousPage()
    expect(page()).toBe(1)
  })

  it('will not go past the last page', () => {
    const page = pageSignal(5)
    const { nextPage } = pageControls(page, () => 5)
    nextPage()
    expect(page()).toBe(5)
  })

  it('reads the last page at click time, not when it was wired up', () => {
    // A filter that shrinks the result set has to shrink the range too.
    const page = pageSignal(1)
    let last = 9
    const { nextPage } = pageControls(page, () => last)
    last = 2
    nextPage()
    nextPage()
    nextPage()
    expect(page()).toBe(2)
  })

  it('clamps an out-of-range page back into the range', () => {
    // The guard style the Marketing dashboards used could not do this: a page
    // already past the end stayed there.
    const page = pageSignal(40)
    const { nextPage, previousPage } = pageControls(page, () => 3)
    nextPage()
    expect(page()).toBe(3)
    page.set(40)
    previousPage()
    expect(page()).toBe(39)
  })

  it('survives an empty result set, where the last page is zero', () => {
    const page = pageSignal(1)
    const { nextPage } = pageControls(page, () => 0)
    nextPage()
    expect(page()).toBe(1)
  })
})
