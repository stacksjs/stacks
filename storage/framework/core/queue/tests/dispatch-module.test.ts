import { afterEach, beforeEach, expect, test } from 'bun:test'
import { Job } from '../src/action'
import { fake, restore } from '../src/testing'

let previousDriver: string | undefined
beforeEach(() => {
  previousDriver = process.env.QUEUE_DRIVER
  process.env.QUEUE_DRIVER = 'sync'
  restore()
})
afterEach(() => {
  restore()
  if (previousDriver === undefined) delete process.env.QUEUE_DRIVER
  else process.env.QUEUE_DRIVER = previousDriver
})

test('dispatch sees fake queue activation, replacement, and restoration after warmup', async () => {
  const seen: number[] = []
  const job = new Job({ name: 'LiveDispatch', queue: 'emails', tries: 3, timeout: 20, handle: (payload: number) => { seen.push(payload) } })
  await job.dispatch(1)
  const first = fake()
  await job.dispatch(2)
  expect(first.dispatched()).toEqual([expect.objectContaining({ name: 'LiveDispatch', data: 2, queue: 'emails', options: { queue: 'emails', tries: 3, timeout: 20 } })])
  const second = fake()
  await job.dispatch(3)
  expect(first.dispatched()).toHaveLength(1)
  expect(second.dispatched()).toEqual([expect.objectContaining({ data: 3 })])
  restore()
  await job.dispatch(4)
  expect(seen).toEqual([1, 4])
})

test('dispatch observes the current driver and propagates handler errors after warmup', async () => {
  const failure = new Error('handler unavailable')
  const seen: number[] = []
  const job = new Job({ name: 'DriverDispatch', handle: (payload: number) => { if (payload < 0) throw failure; seen.push(payload) } })
  await job.dispatch(1)
  process.env.QUEUE_DRIVER = 'unknown-driver'
  await expect(job.dispatch(2)).rejects.toThrow('Unknown QUEUE_DRIVER')
  const queue = fake()
  await job.dispatch(3)
  expect(queue.dispatched()).toEqual([expect.objectContaining({ data: 3 })])
  restore()
  process.env.QUEUE_DRIVER = 'sync'
  await expect(job.dispatch(-1)).rejects.toBe(failure)
  await job.dispatch(4)
  expect(seen).toEqual([1, 4])
})

test('dispatch awaits async handlers and keeps conditional execution live', async () => {
  const seen: number[] = []
  let release = () => {}
  const gate = new Promise<void>((resolve) => { release = resolve })
  const job = new Job({ name: 'AwaitDispatch', handle: async (payload: number) => { await gate; seen.push(payload) } })
  // Prime the module without waiting on the handler gate.
  fake()
  await job.dispatch(0)
  restore()
  let settled = false
  const dispatched = job.dispatch(1).then(() => { settled = true })
  try {
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(settled).toBe(false)
    expect(seen).toEqual([])
  }
  finally {
    release()
    await dispatched
  }
  expect(settled).toBe(true)
  await job.dispatchIf(false, 2)
  await job.dispatchUnless(true, 3)
  await job.dispatchIf(true, 4)
  await job.dispatchUnless(false, 5)
  expect(seen).toEqual([1, 4, 5])
})

test('warm dispatch defers routing and handler execution until after the caller returns', async () => {
  const seen: number[] = []
  const job = new Job({ name: 'DeferredDispatch', handle: (payload: { value: number }) => { seen.push(payload.value) } })
  await job.dispatch({ value: 0 })

  const activating = job.dispatch({ value: 1 })
  const queue = fake()
  await activating
  expect(seen).toEqual([0])
  expect(queue.dispatched()).toEqual([expect.objectContaining({ data: { value: 1 } })])

  const payload = { value: 2 }
  const restoring = job.dispatch(payload)
  restore()
  payload.value = 3
  expect(seen).toEqual([0])
  await restoring
  expect(seen).toEqual([0, 3])

  const changingDriver = job.dispatch({ value: 4 })
  process.env.QUEUE_DRIVER = 'unknown-driver'
  await expect(changingDriver).rejects.toThrow('Unknown QUEUE_DRIVER')
  expect(seen).toEqual([0, 3])
})
