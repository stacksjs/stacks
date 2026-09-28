import { describe, expect, it } from 'bun:test'
import { canGoBack, goBack } from '../src/navigation'

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
