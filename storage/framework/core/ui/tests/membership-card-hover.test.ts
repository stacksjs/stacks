import { describe, expect, test } from 'bun:test'
import { derived, effect, state } from '@stacksjs/stx/signals'

const source = await Bun.file(new URL('../../../defaults/resources/components/MembershipCard.stx', import.meta.url)).text()
const script = source.match(/<script client>([\s\S]*?)<\/script>/)![1]
const compiled = new Bun.Transpiler({ loader: 'ts' }).transformSync(script)

/** Exercise the component's client setup against its composable boundaries. */
function mountCard(options: { hover?: boolean, reduced?: boolean } = {}) {
  const hover = state(options.hover ?? true)
  const reduced = state(options.reduced ?? false)
  const properties = new Map<string, string>()
  const surface = {
    style: { setProperty: (name: string, value: string) => properties.set(name, value) },
    getBoundingClientRect: () => ({ left: 100, top: 100, width: 400, height: 250 }),
  }
  type Mouse = { clientX: number, clientY: number, isInside: boolean }
  let receive: ((point: Mouse) => void) | undefined
  let stopped = 0
  const mounts: Array<() => void> = []
  const destroys: Array<() => void> = []
  const bindings = {
    useReactiveProp: (...props: [string, unknown]) => state(props[1]),
    derived,
    effect,
    useRef: () => ({ current: surface }),
    useMediaQuery: () => hover,
    usePreferredReducedMotion: () => reduced,
    onMount: (callback: () => void) => mounts.push(callback),
    onDestroy: (callback: () => void) => destroys.push(callback),
    useMouse: (settings: { target: unknown, touch: boolean }) => {
      expect(settings.target).toBe(surface)
      expect(settings.touch).toBe(false)
      return {
        subscribe(callback: (point: Mouse) => void) {
          receive = callback
          callback({ clientX: 0, clientY: 0, isInside: false })
          return () => { receive = undefined }
        },
        stop() { stopped++ },
      }
    },
  }
  new Function(...Object.keys(bindings), compiled)(...Object.values(bindings))
  mounts.forEach(callback => callback())
  return {
    hover,
    reduced,
    properties,
    move: (clientX: number, clientY: number) => receive?.({ clientX, clientY, isInside: true }),
    leave: () => receive?.({ clientX: 0, clientY: 0, isInside: false }),
    destroy: () => destroys.forEach(callback => callback()),
    tracking: () => !!receive,
    stopped: () => stopped,
  }
}

describe('membership card hover', () => {
  test('follows both corners and returns to rest on exit', () => {
    const card = mountCard()
    try {
      card.move(490, 110)
      expect(Number.parseFloat(card.properties.get('--mc-rotate-x')!)).toBeGreaterThan(0)
      expect(Number.parseFloat(card.properties.get('--mc-rotate-y')!)).toBeGreaterThan(0)
      card.move(110, 340)
      expect(Number.parseFloat(card.properties.get('--mc-rotate-x')!)).toBeLessThan(0)
      expect(Number.parseFloat(card.properties.get('--mc-rotate-y')!)).toBeLessThan(0)
      card.leave()
      expect(card.properties.get('--mc-rotate-x')).toBe('0deg')
      expect(card.properties.get('--mc-rotate-y')).toBe('0deg')
      expect(card.properties.get('--mc-hover')).toBe('0')
    }
    finally { card.destroy() }
  })

  test('responds to motion and pointer preference changes and cleans up', () => {
    const card = mountCard({ hover: false })
    try {
      expect(card.tracking()).toBe(false)
      card.hover.set(true)
      expect(card.tracking()).toBe(true)
      card.move(480, 120)
      expect(card.properties.get('--mc-hover')).toBe('1')
      card.reduced.set(true)
      expect(card.tracking()).toBe(false)
      expect(card.properties.get('--mc-hover')).toBe('0')
      card.reduced.set(false)
      expect(card.tracking()).toBe(true)
    }
    finally { card.destroy() }
    expect(card.tracking()).toBe(false)
    expect(card.stopped()).toBe(2)
  })

  test('keeps reduced motion still from the first mount', () => {
    const card = mountCard({ reduced: true })
    try {
      expect(card.tracking()).toBe(false)
      card.move(490, 110)
      expect(card.properties.get('--mc-hover')).toBe('0')
    }
    finally { card.destroy() }
  })
})
