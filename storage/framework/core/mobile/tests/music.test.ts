import { afterEach, describe, expect, it } from 'bun:test'
import { mobile, music } from '../src'

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')

function install(craft?: Record<string, unknown>): EventTarget {
  const events = new EventTarget()
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      addEventListener: events.addEventListener.bind(events),
      removeEventListener: events.removeEventListener.bind(events),
      ...(craft ? { craft } : {}),
    },
  })
  return events
}

afterEach(() => {
  if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow)
  else delete (globalThis as any).window
})

const song = { available: true, authorization: 'authorized', source: 'appleMusic', playbackState: 'playing', isPlaying: true, itemId: '7', title: 'Intervals', artist: 'The Pacers', album: null, duration: 214, position: 3, artworkDataURL: 'data:image/jpeg;base64,AAAA', otherAudioPlaying: true, timestamp: 1 }

function appleMusic(calls: unknown[]) {
  return {
    platform: 'ios',
    capabilities: { music: true },
    music: {
      getAuthorizationStatus: async () => 'notDetermined',
      requestAuthorization: async () => { calls.push('request'); return 'authorized' },
      getNowPlaying: async () => song,
      play: async () => { calls.push('play'); return song },
      pause: async () => { calls.push('pause'); return { ...song, isPlaying: false, playbackState: 'paused' } },
      togglePlayPause: async () => { calls.push('toggle'); return song },
      skipToNext: async () => { calls.push('next'); return song },
      skipToPrevious: async (options: unknown) => { calls.push(['previous', options]); return song },
      observe: async (enabled: boolean) => { calls.push(['observe', enabled]); return enabled },
    },
  }
}

describe('music', () => {
  it('reads and steers the Music app through the shell', async () => {
    const calls: unknown[] = []
    install(appleMusic(calls))
    expect(music.isAvailable()).toBe(true)
    expect(music.supports('skipToPrevious')).toBe(true)
    expect(await music.getAuthorizationStatus()).toBe('notDetermined')
    expect(await music.requestAuthorization()).toBe('authorized')
    expect(await music.getNowPlaying()).toMatchObject({ title: 'Intervals', artist: 'The Pacers', isPlaying: true })
    await music.play()
    expect((await music.pause()).isPlaying).toBe(false)
    await music.togglePlayPause()
    await music.skipToNext()
    await music.skipToPrevious({ restartAfter: 0 })
    expect(calls).toEqual(['request', 'play', 'pause', 'toggle', 'next', ['previous', { restartAfter: 0 }]])
    expect(mobile.music).toBe(music)
  })

  it('hears native changes, and observes only while someone listens', async () => {
    const calls: unknown[] = []
    const events = install(appleMusic(calls))
    const heard: (string | null)[] = []
    const stop = music.onChange(now => heard.push(now.title))
    events.dispatchEvent(Object.assign(new Event('craftMusicChange'), { detail: { ...song, title: 'Cooldown', timestamp: 2 } }))
    stop()
    events.dispatchEvent(Object.assign(new Event('craftMusicChange'), { detail: song }))
    await Promise.resolve()
    expect(heard).toEqual(['Cooldown'])
    expect(calls).toEqual([['observe', true], ['observe', false]])
  })

  it('is a no-op in a browser and in a build without the capability', async () => {
    for (const craft of [undefined, { ...appleMusic([]), capabilities: { music: false } }]) {
      install(craft)
      expect(music.isAvailable()).toBe(false)
      expect(await music.getAuthorizationStatus()).toBe('unavailable')
      expect(await music.getNowPlaying()).toMatchObject({ available: false, title: null })
      expect(await music.togglePlayPause()).toMatchObject({ available: false })
      music.onChange(() => { throw new Error('never') })()
    }
  })
})
