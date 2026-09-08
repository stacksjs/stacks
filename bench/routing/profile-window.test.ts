import { expect, test } from 'bun:test'
import { captureCpuWindow } from './profile-window'

function beforeCaptureWork() {
  const until = performance.now() + 100
  let result = 0
  while (performance.now() < until) {
    for (let i = 0; i < 100000; i++) result += Math.sqrt(i)
  }
  return result
}

function duringCaptureWork() {
  const until = performance.now() + 100
  let result = 0
  while (performance.now() < until) {
    for (let i = 0; i < 100000; i++) result += Math.sqrt(i)
  }
  return result
}

test('samples work inside the capture window and excludes work before start', async () => {
  const start = Promise.withResolvers<void>()
  const stop = Promise.withResolvers<void>()
  const started = Promise.withResolvers<void>()
  const pending = captureCpuWindow(start.promise, stop.promise, started.resolve)
  expect(beforeCaptureWork()).toBeGreaterThan(0)
  start.resolve()
  await started.promise
  expect(duringCaptureWork()).toBeGreaterThan(0)
  stop.resolve()
  const result = await pending
  const frames = result.stackTraces.traces.flatMap(trace => trace.frames)
  expect(frames.some(frame => frame.name === 'duringCaptureWork')).toBe(true)
  expect(frames.some(frame => frame.name === 'beforeCaptureWork')).toBe(false)
})
