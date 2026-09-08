import { cache } from '@stacksjs/cache'
import { expect, spyOn, test } from 'bun:test'
import { cancelJob, clearJobState, getJobProgress, isJobCancelled, setJobProgress } from '../src/job-progress'

const progressKey = (id: string) => `__job_progress__:${id}`
const cancelKey = (id: string) => `__job_cancel__:${id}`

test('progress reads current cache values, keeps clones isolated, and retains the one-hour TTL', async () => {
  const id = `progress-${crypto.randomUUID()}`
  try {
    const before = Date.now()
    await setJobProgress(id, 12.5, 'first')
    const first = await getJobProgress(id)
    expect(first?.percent).toBe(12.5)
    expect(first?.message).toBe('first')
    expect(first!.updatedAt).toBeGreaterThanOrEqual(before)
    expect(first!.updatedAt).toBeLessThanOrEqual(Date.now())
    const expiresAt = await cache.getTtl(progressKey(id))
    expect(expiresAt!).toBeGreaterThanOrEqual(before + 3_599_000)
    expect(expiresAt!).toBeLessThanOrEqual(Date.now() + 3_600_000)
    first!.percent = 99
    expect((await getJobProgress(id))?.percent).toBe(12.5)

    await cache.set(progressKey(id), { percent: 75, message: 'external', updatedAt: 123 }, 3600)
    expect(await getJobProgress(id)).toEqual({ percent: 75, message: 'external', updatedAt: 123 })
    await cache.del(progressKey(id))
    expect(await getJobProgress(id)).toBeNull()
    await setJobProgress(id, 150)
    expect((await getJobProgress(id))?.percent).toBe(100)
  }
  finally {
    await clearJobState(id)
  }
})

test('cancellation and cleanup observe live flags and leave other jobs intact', async () => {
  const id = `cancel-${crypto.randomUUID()}`
  const other = `${id}-other`
  try {
    expect(await isJobCancelled(id)).toBe(false)
    await Promise.all([setJobProgress(id, 25), setJobProgress(other, 50), cancelJob(other)])
    const before = Date.now()
    await cancelJob(id)
    expect(await isJobCancelled(id)).toBe(true)
    const expiresAt = await cache.getTtl(cancelKey(id))
    expect(expiresAt!).toBeGreaterThanOrEqual(before + 3_599_000)
    expect(expiresAt!).toBeLessThanOrEqual(Date.now() + 3_600_000)
    await cache.del(cancelKey(id))
    expect(await isJobCancelled(id)).toBe(false)
    await cancelJob(id)
    await clearJobState(id)
    expect(await getJobProgress(id)).toBeNull()
    expect(await isJobCancelled(id)).toBe(false)
    expect(await cache.get(progressKey(id))).toBeUndefined()
    expect(await cache.get(cancelKey(id))).toBeUndefined()
    expect((await getJobProgress(other))?.percent).toBe(50)
    expect(await isJobCancelled(other)).toBe(true)
  }
  finally {
    await Promise.all([clearJobState(id), clearJobState(other)])
  }
})

test('cache errors propagate after warm-up and later operations can recover', async () => {
  const id = `errors-${crypto.randomUUID()}`
  try {
    await setJobProgress(id, 10)
    const failure = new Error('cache unavailable')
    const set = spyOn(cache, 'set').mockRejectedValueOnce(failure)
    try {
      await expect(setJobProgress(id, 90)).rejects.toBe(failure)
    }
    finally {
      set.mockRestore()
    }
    const get = spyOn(cache, 'get').mockRejectedValueOnce(failure)
    try {
      await expect(isJobCancelled(id)).rejects.toBe(failure)
    }
    finally {
      get.mockRestore()
    }
    expect((await getJobProgress(id))?.percent).toBe(10)
    await setJobProgress(id, 90)
    expect((await getJobProgress(id))?.percent).toBe(90)
    expect(await isJobCancelled(id)).toBe(false)
  }
  finally {
    await clearJobState(id)
  }
})
