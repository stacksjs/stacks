import { describe, expect, it } from 'bun:test'
import { observePageScroll, observePullToRefresh, pageScrollTop, pullDistance } from '../src/gestures'

class FakePage extends EventTarget {
  scrollY = 0

  touch(type: string, clientY?: number): void {
    const event = new Event(type) as Event & { touches: Array<{ clientY: number }> }
    event.touches = clientY === undefined ? [] : [{ clientY }]
    this.dispatchEvent(event)
  }
}

describe('page gestures', () => {
  it('measures a pull by the rubber band on iOS and by the finger elsewhere', () => {
    expect(pullDistance(-80, 0)).toBe(80)
    expect(pullDistance(0, 100)).toBe(50)
    expect(pullDistance(-30, 100)).toBe(50)
    // Scrolled into the page, nothing is a pull.
    expect(pullDistance(120, 300)).toBe(0)
    expect(pullDistance(0, -40)).toBe(0)
  })

  it('reads the scroll offset, negative while bouncing', () => {
    const page = new FakePage()
    page.scrollY = -24
    expect(pageScrollTop(page)).toBe(-24)
    expect(pageScrollTop(undefined)).toBe(0)
  })

  it('refreshes once when released past the threshold, and not when pulled back', async () => {
    const page = new FakePage()
    const pulls: Array<[number, boolean]> = []
    let refreshed = 0
    const stop = observePullToRefresh({
      host: page,
      threshold: 60,
      onPull: (distance, armed) => pulls.push([distance, armed]),
      onRefresh: () => { refreshed++ },
    })

    page.touch('touchstart', 100)
    page.touch('touchmove', 180) // 40: under the threshold
    page.touch('touchmove', 240) // 70: armed
    page.touch('touchend')
    await Promise.resolve()
    expect(refreshed).toBe(1)
    expect(pulls).toContainEqual([70, true])
    expect(pulls.at(-1)).toEqual([0, false])

    // Armed, then pulled back under 80% of the threshold: no refresh.
    page.touch('touchstart', 100)
    page.touch('touchmove', 240)
    page.touch('touchmove', 150)
    page.touch('touchend')
    await Promise.resolve()
    expect(refreshed).toBe(1)

    // A cancelled touch never refreshes.
    page.touch('touchstart', 100)
    page.touch('touchmove', 260)
    page.touch('touchcancel')
    await Promise.resolve()
    expect(refreshed).toBe(1)
    stop()
  })

  it('ignores a pull that starts below the top of the page, and pulls while refreshing', async () => {
    const page = new FakePage()
    let refreshed = 0
    let finish: () => void = () => {}
    observePullToRefresh({
      host: page,
      onRefresh: () => new Promise<void>((resolve) => { refreshed++; finish = resolve }),
    })

    page.scrollY = 200
    page.touch('touchstart', 100)
    page.touch('touchmove', 400)
    page.touch('touchend')
    expect(refreshed).toBe(0)

    page.scrollY = 0
    page.touch('touchstart', 100)
    page.touch('touchmove', 300)
    page.touch('touchend')
    expect(refreshed).toBe(1)
    page.touch('touchstart', 100)
    page.touch('touchmove', 300)
    page.touch('touchend')
    expect(refreshed).toBe(1)
    finish()
  })

  it('reports the scroll offset at once and after scrolling', async () => {
    const page = new FakePage()
    const offsets: number[] = []
    const stop = observePageScroll(offset => offsets.push(offset), page)
    page.scrollY = 90
    page.dispatchEvent(new Event('scroll'))
    await new Promise(resolve => setTimeout(resolve, 30))
    expect(offsets).toEqual([0, 90])
    stop()
  })
})
