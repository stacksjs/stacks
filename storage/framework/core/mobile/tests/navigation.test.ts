import { describe, expect, it } from 'bun:test'
import { backLabelFor, canGoBack, enterNavTrail, goBack } from '../src/navigation'
import type { NavTrailEntry } from '../src/navigation'

describe('back navigation', () => {
  it('goes back only through entries the app pushed', () => {
    let backs = 0
    const pushed = { history: { state: {}, back: () => { backs++ } } }
    const coldStart = { history: { state: null, back: () => { backs++ } } }

    expect(canGoBack(pushed)).toBe(true)
    expect(goBack(pushed)).toBe(true)
    expect(backs).toBe(1)

    expect(canGoBack(coldStart)).toBe(false)
    expect(goBack(coldStart)).toBe(false)
    expect(backs).toBe(1)

    expect(goBack(undefined)).toBe(false)
  })

  it('tells an entry the STX router pushed from the one it opened with', () => {
    const host = (state: unknown) => ({ history: { state, back: () => {} } })
    expect(canGoBack(host({ __stxScroll: 'a', __stxPushed: true }))).toBe(true)
    // The router stamps its scroll token on the first entry too.
    expect(canGoBack(host({ __stxScroll: 'a' }))).toBe(false)
    expect(canGoBack(host({ __stxPushed: false }))).toBe(false)
  })
})

describe('deep links', () => {
  it('opens a custom-scheme or same-origin link at its path, and nothing else', async () => {
    const { deepLinkPath } = await import('../src/navigation')
    const origin = 'https://hq.training'
    expect(deepLinkPath('hqtraining://m/workout/5', origin)).toBe('/m/workout/5')
    expect(deepLinkPath('hqtraining:///m/workout/5?tab=notes#top', origin)).toBe('/m/workout/5?tab=notes#top')
    expect(deepLinkPath('hqtraining://', origin)).toBe('/')
    expect(deepLinkPath('https://hq.training/m/calendar', origin)).toBe('/m/calendar')
    expect(deepLinkPath('https://evil.example/m/calendar', origin)).toBeNull()
    expect(deepLinkPath('not a url', origin)).toBeNull()
  })

  it('opens the launch link once per session and every later link', async () => {
    const { followDeepLinks } = await import('../src/navigation')
    const store = new Map<string, string>()
    const original = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage')
    Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => { store.set(key, value) },
    } })
    try {
      const opened: string[] = []
      let deliver: (url: string, link?: { initial: boolean }) => void = () => {}
      const links = {
        getInitialURL: async () => 'hqtraining://m/workout/5',
        onLink: (callback: typeof deliver) => { deliver = callback; return () => {} },
      }
      followDeepLinks(path => opened.push(path), links)
      await new Promise(resolve => setTimeout(resolve, 0))
      deliver('hqtraining://m/workout/5', { initial: true }) // the same launch link, replayed
      deliver('hqtraining://m/calendar', { initial: false })
      // A full page load in the app starts over; the launch link is not reopened.
      followDeepLinks(path => opened.push(path), links)
      await new Promise(resolve => setTimeout(resolve, 0))
      expect(opened).toEqual(['/m/workout/5', '/m/calendar'])
    }
    finally {
      if (original) Object.defineProperty(globalThis, 'sessionStorage', original)
      else Reflect.deleteProperty(globalThis, 'sessionStorage')
    }
  })
})

describe('the trail of screens a back button names', () => {
  it('pushes a new screen and names the one before it', () => {
    const trail: NavTrailEntry[] = []
    enterNavTrail(trail, '/m').current.title = 'Today'
    const { previous } = enterNavTrail(trail, '/m/workout/5')
    expect(previous?.title).toBe('Today')
    expect(trail.map(entry => entry.path)).toEqual(['/m', '/m/workout/5'])
  })

  it('pops when the screen arrived at is the one before', () => {
    const trail: NavTrailEntry[] = [{ path: '/m', title: 'Today' }, { path: '/m/calendar', title: 'Calendar' }, { path: '/m/workout/5', title: 'Core' }]
    const { current, previous } = enterNavTrail(trail, '/m/calendar')
    expect(current.title).toBe('Calendar')
    expect(previous?.title).toBe('Today')
    expect(trail).toHaveLength(2)
  })

  it('leaves a re-render of the same screen alone', () => {
    const trail: NavTrailEntry[] = [{ path: '/m', title: 'Today' }]
    enterNavTrail(trail, '/m')
    expect(trail).toHaveLength(1)
  })

  it('keeps a bounded trail', () => {
    const trail: NavTrailEntry[] = []
    for (let i = 0; i < 60; i++) enterNavTrail(trail, `/m/workout/${i}`, 50)
    expect(trail).toHaveLength(50)
    expect(trail[0]!.path).toBe('/m/workout/10')
  })

  it('says the screen\'s name when it is short, and its own word when not', () => {
    expect(backLabelFor({ path: '/m', title: 'Today' }, 'Calendar')).toBe('Today')
    expect(backLabelFor({ path: '/m/workout/5', title: 'Core Workout for Runners' }, 'Workout')).toBe('Workout')
    expect(backLabelFor(null, 'Back')).toBe('Back')
    expect(backLabelFor({ path: '/m', title: '  ' }, 'Back')).toBe('Back')
  })
})
