import { describe, expect, it } from 'bun:test'
import { createRouteRecorder } from '../src/route'

const firstFix = { latitude: 52.5, longitude: 13.4, accuracy: 5, timestamp: 1000 }

const secondRoute = [
  { latitude: 40.7, longitude: -74, accuracy: 5, timestamp: 2000 },
  { latitude: 40.701, longitude: -74, accuracy: 5, timestamp: 3000 },
]

/** One native recording slot shared by screens and accounts on a phone. */
function sharedLocation(initiallyActive = true) {
  const calls: string[] = []
  let id: string | null = initiallyActive ? 'athlete-a-route' : null
  let active = initiallyActive
  let paused = false
  let fixes = [firstFix]
  const state = () => ({ id, active, paused, startedAt: id ? 1000 : null, sampleCount: fixes.length })
  const archives = new Map<string, { state: ReturnType<typeof state>, locations: typeof fixes }>()
  function archive() { if (id && !active) archives.set(id, { state: state(), locations: fixes.slice() }) }
  const conflict = () => Object.assign(new Error('The recording belongs to another session'), { code: 'RECORDING_CONFLICT' })
  function check(options?: { expectedId: string }) {
    if (options && options.expectedId !== id) throw conflict()
  }
  const api = {
    supportsRecordingOwnership: () => true,
    supportsRecordingIntentIdentity: () => true,
      acknowledgeRecording: async () => { throw new Error('Only the app may acknowledge its durable checkpoint') },
    getCurrentPosition: async () => firstFix,
    watchPosition: () => 1,
    clearWatch: () => {},
    startRecording: async (options?: { recordingId?: string }) => {
      calls.push('start')
      if (active) throw conflict()
      archive()
      id = options?.recordingId ?? 'new-route'
      active = true
      paused = false
      fixes = []
      return state()
    },
    pauseRecording: async (options?: { expectedId: string }) => {
      calls.push('pause')
      check(options)
      paused = true
      return state()
    },
    resumeRecording: async (options?: { expectedId: string }) => {
      calls.push('resume')
      check(options)
      paused = false
      return state()
    },
    stopRecording: async (options?: { expectedId: string }) => {
      calls.push('stop')
      if (options?.expectedId !== id) {
        const completed = options && archives.get(options.expectedId)
        if (completed) return { ...completed.state, locations: completed.locations.slice() }
      }
      check(options)
      active = false
      return { ...state(), locations: fixes }
    },
    getRecordingState: async (options?: { expectedId: string }) => {
      calls.push('state')
      if (options?.expectedId !== id) {
        const completed = options && archives.get(options.expectedId)
        if (completed) return { ...completed.state }
      }
      check(options)
      return state()
    },
    readRecording: async (options?: { expectedId: string }) => {
      calls.push('read')
      if (options?.expectedId !== id) {
        const completed = options && archives.get(options.expectedId)
        if (completed) return completed.locations.slice()
      }
      check(options)
      return fixes
    },
  }
  return {
    api, calls, state, fixes: () => fixes,
    replace: (nextId: string, nextFixes = fixes) => { archive()
      id = nextId
      active = true
      paused = false
      fixes = nextFixes },
  }
}

function sharedHeartRate(initiallyActive = true) {
  const calls: string[] = []
  const guards: string[] = []
  const samples = initiallyActive ? [{ timestamp: 1000, bpm: 69 }] : []
  let id: string | null = initiallyActive ? 'athlete-a-heart' : null
  let active = initiallyActive
  let paused = false
  const state = () => ({ id, active, paused, startedAt: 1000, sampleCount: samples.length })
  const check = (options?: { expectedId: string }) => {
    if (options) guards.push(options.expectedId)
    if (options && options.expectedId !== state().id)
      throw Object.assign(new Error('The heart-rate recording belongs to another session'), { code: 'RECORDING_CONFLICT' })
  }
  const api = {
    isAvailable: () => true,
    supportsRecordingOwnership: () => true,
    supportsRecordingIntentIdentity: () => true,
      acknowledgeRecording: async () => { throw new Error('Only the app may acknowledge its durable checkpoint') },
    startRecording: async (options?: { recordingId?: string }) => { calls.push('start')
      if (active) throw new Error('Already recording')
      id = options?.recordingId ?? 'new-heart'
      active = true
      samples.length = 0
      return state() },
    pauseRecording: async (options?: { expectedId: string }) => { calls.push('pause')
      check(options)
      paused = true
      return state() },
    resumeRecording: async (options?: { expectedId: string }) => { calls.push('resume')
      check(options)
      paused = false
      return state() },
    stopRecording: async (options?: { expectedId: string }) => { calls.push('stop')
      check(options)
      active = false
      return { ...state(), samples: [...samples] } },
    getRecordingState: async () => { calls.push('state')
      return state() },
    readRecording: async (options?: { expectedId?: string, since?: number }) => {
      calls.push('read')
      if (options?.expectedId) check({ expectedId: options.expectedId })
      return samples
    },
  }
  return { api, calls, guards, state, samples }
}

describe('native route recording ownership', () => {
  it('preserves a native route when the saved draft has no recording ID', async () => {
    const phone = sharedLocation()
    const recorder = createRouteRecorder({ location: phone.api })
    try {
      // A legacy JavaScript caller must not adopt whichever recording is active.
      await expect(Reflect.apply(recorder.attach, recorder, [])).rejects.toMatchObject({ code: 'RECORDING_CONFLICT' })
      expect(phone.calls).toEqual([])
      expect(phone.state()).toMatchObject({ id: 'athlete-a-route', active: true })
      expect(phone.fixes()).toEqual([firstFix])
    }
    finally {
      recorder.dispose()
    }
  })

  it('does not read athlete A\'s route while recovering athlete B\'s older draft', async () => {
    const phone = sharedLocation()
    const recorder = createRouteRecorder({ location: phone.api })
    try {
      await expect(recorder.attach({ expectedId: 'athlete-b-route' })).rejects.toMatchObject({ code: 'RECORDING_CONFLICT' })
      expect(phone.calls).toEqual(['state'])
      expect(phone.state()).toMatchObject({ id: 'athlete-a-route', active: true })
      expect(phone.fixes()).toEqual([firstFix])
    }
    finally {
      recorder.dispose()
    }
  })

  it('fences the sample read if the native slot changes after the metadata response', async () => {
    const phone = sharedLocation()
    const metadata = phone.api.getRecordingState
    phone.api.getRecordingState = async () => {
      const snapshot = await metadata()
      phone.replace('athlete-b-route')
      return snapshot
    }
    const recorder = createRouteRecorder({ location: phone.api })
    try {
      await expect(recorder.attach({ expectedId: 'athlete-a-route' })).rejects.toMatchObject({ code: 'RECORDING_CONFLICT' })
      expect(phone.state()).toMatchObject({ id: 'athlete-b-route', active: true })
      expect(phone.fixes()).toEqual([firstFix])
    }
    finally {
      recorder.dispose()
    }
  })

  it('keeps the ID returned by start as provenance after the route finishes', async () => {
    const phone = sharedLocation(false)
    const recorder = createRouteRecorder({ location: phone.api })
    try {
      await recorder.start()
      expect(recorder.recordingId).toBe('new-route')
      await recorder.stop()
      expect(recorder.recordingId).toBe('new-route')
    }
    finally {
      recorder.dispose()
    }
  })

  it('never pauses, resumes or stops a replacement athlete\'s route', async () => {
    const phone = sharedLocation()
    const recorder = createRouteRecorder({ location: phone.api })
    try {
      await recorder.attach({ expectedId: 'athlete-a-route' })
      phone.replace('athlete-b-route')
      for (const command of [() => recorder.pause(), () => recorder.resume(), () => recorder.stop()]) {
        await expect(command()).rejects.toMatchObject({ code: 'RECORDING_CONFLICT' })
        expect(phone.state()).toMatchObject({ id: 'athlete-b-route', active: true, paused: false })
        expect(phone.fixes()).toEqual([firstFix])
      }
    }
    finally {
      recorder.dispose()
    }
  })

  it('fails closed on a host that cannot enforce recording IDs', async () => {
    const phone = sharedLocation()
    phone.api.supportsRecordingOwnership = () => false
    const recorder = createRouteRecorder({ location: phone.api })
    try {
      for (const command of [
        () => recorder.start(),
        () => recorder.attach({ expectedId: 'athlete-a-route' }),
        () => recorder.refresh(),
        () => recorder.pause(),
        () => recorder.resume(),
        () => recorder.stop(),
      ]) {
        await expect(command()).rejects.toMatchObject({ code: 'RECORDING_OWNERSHIP_UNSUPPORTED' })
      }
      expect(phone.calls).toEqual([])
      expect(phone.state()).toMatchObject({ id: 'athlete-a-route', active: true, paused: false })
      expect(phone.fixes()).toEqual([firstFix])
    }
    finally {
      recorder.dispose()
    }
  })

  it('does not execute a queued recording command after its screen is disposed', async () => {
    const phone = sharedLocation(false)
    const recorder = createRouteRecorder({ location: phone.api })
    const starting = recorder.start()
    recorder.dispose()
    await expect(starting).rejects.toMatchObject({ code: 'RECORDING_CONFLICT' })
    expect(phone.calls).toEqual([])
    expect(phone.state().active).toBe(false)
  })

  it('returns an already stopped owned route after disposal without touching a replacement route', async () => {
    const phone = sharedLocation()
    const updates: number[] = []
    const recorder = createRouteRecorder({ location: phone.api, onUpdate: stats => updates.push(stats.fixes) })
    await recorder.attach({ expectedId: 'athlete-a-route' })
    updates.length = 0
    const nativeStop = phone.api.stopRecording
    let release!: () => void
    let stopped!: () => void
    const nativeStopped = new Promise<void>(resolve => { stopped = resolve })
    phone.api.stopRecording = async (options) => {
      const result = await nativeStop(options)
      stopped()
      return new Promise(resolve => { release = () => resolve(result) })
    }
    const ending = recorder.stop()
    await nativeStopped
    recorder.dispose()
    const secondFix = { latitude: 40.7, longitude: -74, accuracy: 5, timestamp: 2000 }
    phone.replace('athlete-b-route', [secondFix])
    release()
    expect(await ending).toEqual([firstFix])
    expect(recorder.recordingId).toBe('athlete-a-route')
    expect(updates).toEqual([])
    expect(phone.state()).toMatchObject({ id: 'athlete-b-route', active: true, paused: false })
    expect(phone.fixes()).toEqual([secondFix])
    expect(phone.calls).toEqual(['state', 'read', 'stop'])
  })

  it('leaves a bundled foreign heart-rate recording untouched when no saved heart ID was supplied', async () => {
    const phone = sharedLocation()
    phone.replace('athlete-b-route')
    const heart = sharedHeartRate()
    const recorder = createRouteRecorder({ location: phone.api, heartRate: heart.api })
    try {
      await recorder.attach({ expectedId: 'athlete-b-route' })
      await recorder.pause()
      await recorder.resume()
      await recorder.stop()
      expect(heart.calls).toEqual([])
      expect(heart.state()).toMatchObject({ id: 'athlete-a-heart', active: true, paused: false })
      expect(heart.samples).toEqual([{ timestamp: 1000, bpm: 69 }])
      expect(recorder.heartRate).toEqual([])
    }
    finally {
      recorder.dispose()
    }
  })

  it('captures and fences the bundled heart-rate recording started with this route', async () => {
    const phone = sharedLocation(false)
    const heart = sharedHeartRate(false)
    const recorder = createRouteRecorder({ location: phone.api, heartRate: heart.api })
    try {
      await recorder.start()
      expect(recorder.heartRateRecordingId).toBe('new-heart')
      heart.samples.push({ timestamp: 1000, bpm: 77 })
      await recorder.pause()
      await recorder.resume()
      await recorder.stop()
      expect(heart.calls).toEqual(['start', 'pause', 'resume', 'stop'])
      expect(heart.guards).toEqual(['new-heart', 'new-heart', 'new-heart'])
      expect(recorder.heartRate).toEqual([{ timestamp: 1000, bpm: 77 }])
      expect(recorder.heartRateRecordingId).toBe('new-heart')
    }
    finally {
      recorder.dispose()
    }
  })

  it('recovers a completed owned route and heart recording after the stop acknowledgement was lost', async () => {
    const phone = sharedLocation()
    const heart = sharedHeartRate()
    await phone.api.stopRecording({ expectedId: 'athlete-a-route' })
    await heart.api.stopRecording({ expectedId: 'athlete-a-heart' })
    phone.calls.length = 0
    heart.calls.length = 0
    const recorder = createRouteRecorder({ location: phone.api, heartRate: heart.api })
    try {
      expect(await recorder.attach({ expectedId: 'athlete-a-route', expectedHeartRateId: 'athlete-a-heart' })).toMatchObject({ id: 'athlete-a-route', active: false })
      expect(recorder.recordingId).toBe('athlete-a-route')
      const result = recorder.stop()
      expect(recorder.stop()).toBe(result)
      expect(await result).toEqual([{ ...firstFix, heartRate: 69 }])
      expect(recorder.heartRate).toEqual([{ timestamp: 1000, bpm: 69 }])
      expect(phone.calls).toEqual(['state', 'read', 'stop'])
      expect(heart.calls).toEqual(['state', 'read', 'stop'])
      expect(phone.state().active).toBe(false)
      expect(heart.state().active).toBe(false)
    }
    finally { recorder.dispose() }
  })

  it('does not read a foreign completed route when recovering another athlete draft', async () => {
    const phone = sharedLocation()
    await phone.api.stopRecording({ expectedId: 'athlete-a-route' })
    phone.calls.length = 0
    const recorder = createRouteRecorder({ location: phone.api })
    try {
      await expect(recorder.attach({ expectedId: 'athlete-b-route' })).rejects.toMatchObject({ code: 'RECORDING_CONFLICT' })
      expect(phone.calls).toEqual(['state'])
      expect(phone.fixes()).toEqual([firstFix])
    }
    finally { recorder.dispose() }
  })

  it('recovers an explicitly saved archived A route while leaving B recording active', async () => {
    const phone = sharedLocation()
    await phone.api.stopRecording({ expectedId: 'athlete-a-route' })
    const secondFix = { latitude: 40.7, longitude: -74, accuracy: 5, timestamp: 2000 }
    phone.replace('athlete-b-route', [secondFix])
    phone.calls.length = 0
    const recorder = createRouteRecorder({ location: phone.api })
    try {
      expect(await recorder.attach({ expectedId: 'athlete-a-route' })).toMatchObject({ id: 'athlete-a-route', active: false })
      expect(await recorder.stop()).toEqual([firstFix])
      expect(phone.state()).toMatchObject({ id: 'athlete-b-route', active: true, paused: false })
      expect(phone.fixes()).toEqual([secondFix])
      expect(phone.calls).toEqual(['state', 'read', 'stop'])
    }
    finally { recorder.dispose() }
  })

  it('recovers bundled heart data only through its explicitly saved ID', async () => {
    const phone = sharedLocation()
    const heart = sharedHeartRate()
    const recorder = createRouteRecorder({ location: phone.api, heartRate: heart.api })
    try {
      await recorder.attach({ expectedId: 'athlete-a-route', expectedHeartRateId: 'athlete-a-heart' })
      expect(recorder.heartRateRecordingId).toBe('athlete-a-heart')
      await recorder.pause()
      await recorder.resume()
      await recorder.stop()
      expect(heart.calls).toEqual(['state', 'read', 'pause', 'resume', 'stop'])
      expect(heart.guards).toEqual(Array(4).fill('athlete-a-heart'))
      expect(recorder.heartRate).toEqual([{ timestamp: 1000, bpm: 69 }])
    }
    finally {
      recorder.dispose()
    }
  })
})

describe('registered caller recording identities', () => {
  it('forwards distinct pre-registered GPS and heart-rate identities', async () => {
    const phone = sharedLocation(false)
    const heart = sharedHeartRate(false)
    const recorder = createRouteRecorder({ location: phone.api, heartRate: heart.api })
    try {
      await recorder.start({ recordingId: 'planned-A-route', heartRateRecordingId: 'planned-A-heart' })
      expect(recorder.recordingId).toBe('planned-A-route')
      expect(recorder.heartRateRecordingId).toBe('planned-A-heart')
      expect(phone.state()).toMatchObject({ id: 'planned-A-route', active: true })
      expect(heart.state()).toMatchObject({ id: 'planned-A-heart', active: true })
    }
    finally { recorder.dispose() }
  })

  it('rejects an adapter without intent identity support before a native start', async () => {
    const phone = sharedLocation(false)
    phone.api.supportsRecordingIntentIdentity = () => false
    const recorder = createRouteRecorder({ location: phone.api })
    try {
      await expect(recorder.start({ recordingId: 'saved-A-route' })).rejects.toMatchObject({ code: 'RECORDING_INTENT_IDENTITY_UNSUPPORTED' })
      expect(phone.calls).toEqual([])
      expect(phone.state().id).toBe(null)
    }
    finally { recorder.dispose() }
  })

  it('refuses a native start response with a different identity', async () => {
    const phone = sharedLocation(false)
    const nativeStart = phone.api.startRecording
    phone.api.startRecording = async () => nativeStart({ recordingId: 'unexpected-route' })
    const recorder = createRouteRecorder({ location: phone.api })
    try {
      await expect(recorder.start({ recordingId: 'saved-A-route' })).rejects.toMatchObject({ code: 'RECORDING_CONFLICT' })
      expect(recorder.recordingId).toBe(null)
      expect(phone.calls).toEqual(['start'])
    }
    finally { recorder.dispose() }
  })

  it('recovers the pre-registered ID after native start succeeds but its response is lost', async () => {
    const phone = sharedLocation(false)
    const nativeStart = phone.api.startRecording
    phone.api.startRecording = async (options) => {
      await nativeStart(options)
      throw new Error('Native start response lost')
    }
    const first = createRouteRecorder({ location: phone.api })
    try {
      await expect(first.start({ recordingId: 'durable-A-route' })).rejects.toThrow('response lost')
      expect(phone.state()).toMatchObject({ id: 'durable-A-route', active: true })
    }
    finally { first.dispose() }
    const reopened = createRouteRecorder({ location: phone.api })
    try {
      expect(await reopened.attach({ expectedId: 'durable-A-route' })).toMatchObject({ id: 'durable-A-route', active: true })
      await reopened.stop()
      expect(phone.calls.filter(call => call === 'start')).toHaveLength(1)
      expect(phone.state()).toMatchObject({ id: 'durable-A-route', active: false })
    }
    finally { reopened.dispose() }
  })
})

describe('same recorder reuse', () => {
  it('stops B and returns B fixes after stopping A and attaching B on the same controller', async () => {
    const phone = sharedLocation()
    const stoppedIds: Array<string | undefined> = []
    const nativeStop = phone.api.stopRecording
    phone.api.stopRecording = async (options) => {
      stoppedIds.push(options?.expectedId)
      return nativeStop(options)
    }
    const recorder = createRouteRecorder({ location: phone.api })
    try {
      await recorder.attach({ expectedId: 'athlete-a-route' })
      expect(await recorder.stop()).toEqual([firstFix])
      phone.replace('athlete-b-route', secondRoute)
      await recorder.attach({ expectedId: 'athlete-b-route' })
      expect(await recorder.stop()).toEqual(secondRoute)
      expect(phone.state()).toMatchObject({ id: 'athlete-b-route', active: false })
      expect(stoppedIds).toEqual(['athlete-a-route', 'athlete-b-route'])
      expect(phone.calls.filter(call => call === 'stop')).toHaveLength(2)
    }
    finally { recorder.dispose() }
  })

  it('clears A private heart data when the same controller attaches GPS-only B', async () => {
    const phone = sharedLocation()
    const heart = sharedHeartRate()
    const recorder = createRouteRecorder({ location: phone.api, heartRate: heart.api })
    try {
      await recorder.attach({ expectedId: 'athlete-a-route', expectedHeartRateId: 'athlete-a-heart' })
      await recorder.stop()
      expect(recorder.heartRateRecordingId).toBe('athlete-a-heart')
      expect(recorder.heartRate).toEqual([{ timestamp: 1000, bpm: 69 }])
      const before = heart.calls.slice()
      phone.replace('athlete-b-route', secondRoute)
      await recorder.attach({ expectedId: 'athlete-b-route' })
      expect(recorder.heartRateRecordingId).toBeNull()
      expect(recorder.heartRate).toEqual([])
      expect(await recorder.stop()).toEqual(secondRoute)
      expect(heart.calls).toEqual(before)
    }
    finally { recorder.dispose() }
  })

  it('keeps A selected when attaching B rejects its supplied heart recording identity', async () => {
    const phone = sharedLocation()
    const heart = sharedHeartRate()
    const recorder = createRouteRecorder({ location: phone.api, heartRate: heart.api })
    try {
      await recorder.attach({ expectedId: 'athlete-a-route', expectedHeartRateId: 'athlete-a-heart' })
      await recorder.stop()
      const prior = { stats: recorder.stats, heartId: recorder.heartRateRecordingId, heart: recorder.heartRate.slice() }
      phone.replace('athlete-b-route', secondRoute)
      await expect(recorder.attach({ expectedId: 'athlete-b-route', expectedHeartRateId: 'missing-b-heart' })).rejects.toMatchObject({ code: 'RECORDING_CONFLICT' })
      expect(recorder.recordingId).toBe('athlete-a-route')
      expect(recorder.stats).toEqual(prior.stats)
      expect(recorder.heartRateRecordingId).toBe(prior.heartId)
      expect(recorder.heartRate).toEqual(prior.heart)
      expect(phone.state()).toMatchObject({ id: 'athlete-b-route', active: true })
    }
    finally { recorder.dispose() }
  })

  it('keeps B stats private from a held A read when the same controller attaches B', async () => {
    const phone = sharedLocation()
    const updates: Array<{ id: string | null, fixes: number }> = []
    const recorder = createRouteRecorder({ location: phone.api, onUpdate: stats => updates.push({ id: recorder.recordingId, fixes: stats.fixes }) })
    const gate = Promise.withResolvers<void>()
    const reading = Promise.withResolvers<void>()
    let held: Promise<unknown> | null = null
    try {
      await recorder.attach({ expectedId: 'athlete-a-route' })
      const nativeRead = phone.api.readRecording
      phone.api.readRecording = async (options) => {
        const snapshot = await nativeRead(options)
        if (options?.expectedId === 'athlete-a-route') {
          reading.resolve()
          await gate.promise
        }
        return snapshot
      }
      held = recorder.refresh()
      await reading.promise
      // Another native owner has finished A and started B while its old read
      // response is in flight. Only the saved B identity is attached here.
      await phone.api.stopRecording({ expectedId: 'athlete-a-route' })
      phone.replace('athlete-b-route', secondRoute)
      updates.length = 0
      const attaching = recorder.attach({ expectedId: 'athlete-b-route' })
      // Let B's native promises settle before the delayed A response arrives.
      await new Promise<void>(resolve => setTimeout(() => {
        gate.resolve()
        resolve()
      }, 0))
      await attaching
      expect(await held).toMatchObject({ fixes: 1 })
      expect(recorder.recordingId).toBe('athlete-b-route')
      expect(recorder.stats.fixes).toBe(secondRoute.length)
      expect(updates.filter(update => update.id === 'athlete-b-route')).toEqual([{ id: 'athlete-b-route', fixes: secondRoute.length }])
      expect(phone.state()).toMatchObject({ id: 'athlete-b-route', active: true })
    }
    finally {
      gate.resolve()
      if (held) await held
      recorder.dispose()
    }
  })
})
