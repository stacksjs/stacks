// The media pipeline behind uploads (stacksjs/stacks#2578).
//
// What is tested here is the dispatch and the state, not the encoders. Whether
// `ts-images` produces a correct WebP is that package's business; what this
// layer has to get right is which work an upload calls for, that a queue being
// down leaves a visible failure rather than a silently unprocessed file, and
// that the state survives the file being renamed.
//
// The dispatcher is a recording function rather than a real queue, so these run
// without a worker.

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdtemp, mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { StorageManager } from '@stacksjs/storage'
import type { DashboardFileNode } from './file-manager'
import {
  deleteDashboardFile,
  dispatchDashboardFileTasks,
  getDashboardFileSnapshot,
  renameDashboardFile,
  reprocessDashboardFile,
} from './file-manager'
import {
  aggregateTaskState,
  createMemoryMetadataStore,
  describeError,
  runTask,
  tasksForContentType,
} from './file-metadata'

let root = ''
let manager: StorageManager
let store = createMemoryMetadataStore()
let dispatched: Array<{ job: string, payload: Record<string, unknown> }> = []
const dispatch = async (job: string, payload: Record<string, unknown>): Promise<void> => {
  dispatched.push({ job, payload })
}

beforeEach(async () => {
  store = createMemoryMetadataStore()
  dispatched = []
  root = await mkdtemp(join(tmpdir(), 'stacks-file-pipeline-'))
  await mkdir(join(root, 'public'), { recursive: true })
  manager = new StorageManager().init({
    default: 'public',
    disks: {
      public: { driver: 'local', root: join(root, 'public'), url: '/storage', visibility: 'public' },
    },
  })
})

afterEach(async () => {
  manager.reset()
  await rm(root, { force: true, recursive: true })
})

function nodeAt(node: DashboardFileNode, path: string): DashboardFileNode | undefined {
  if (node.path === path)
    return node
  for (const child of node.items ?? []) {
    const found = nodeAt(child, path)
    if (found)
      return found
  }
  return undefined
}

describe('tasksForContentType', () => {
  test('an image is optimized and tagged', () => {
    expect(tasksForContentType('image/png')).toEqual(['optimize', 'tag'])
    expect(tasksForContentType('image/jpeg; charset=binary')).toEqual(['optimize', 'tag'])
  })

  test('a video is transcoded and tagged', () => {
    expect(tasksForContentType('video/mp4')).toEqual(['transcode', 'tag'])
  })

  test('SVG is left alone, because it is markup rather than a raster', () => {
    // Nothing to re-encode, and running markup through an image decoder is a
    // parser attack surface for no benefit.
    expect(tasksForContentType('image/svg+xml')).toEqual([])
  })

  test('everything else calls for nothing', () => {
    // Most uploads are documents. A queue entry per PDF that immediately finds
    // nothing to do is noise in the one place somebody looks when a transcode
    // is stuck.
    expect(tasksForContentType('application/pdf')).toEqual([])
    expect(tasksForContentType('text/plain')).toEqual([])
    expect(tasksForContentType(undefined)).toEqual([])
    expect(tasksForContentType('')).toEqual([])
  })
})

describe('aggregateTaskState', () => {
  test('is null when nothing was ever dispatched', () => {
    // Not the same as work that finished: an image uploaded before
    // optimization existed should not claim to have been optimized.
    expect(aggregateTaskState([])).toBeNull()
  })

  test('reports the worst state, because a failure is what needs surfacing', () => {
    const done = { kind: 'optimize', state: 'done', attempts: 1 } as const
    const failed = { kind: 'tag', state: 'failed', attempts: 2 } as const
    const running = { kind: 'transcode', state: 'running', attempts: 1 } as const
    const queued = { kind: 'tag', state: 'queued', attempts: 0 } as const

    expect(aggregateTaskState([done, failed])).toBe('failed')
    expect(aggregateTaskState([done, running])).toBe('running')
    expect(aggregateTaskState([done, queued])).toBe('queued')
    expect(aggregateTaskState([done])).toBe('done')
    // A failure outranks work still in flight.
    expect(aggregateTaskState([running, failed])).toBe('failed')
  })
})

describe('dispatchDashboardFileTasks', () => {
  test('queues the jobs an image calls for, and records them', async () => {
    await manager.disk('public').write('photo.png', 'x')

    const tasks = await dispatchDashboardFileTasks(
      { path: 'photo.png', contentType: 'image/png' },
      manager,
      store,
      dispatch,
    )

    expect(tasks.map(task => task.kind)).toEqual(['optimize', 'tag'])
    expect(dispatched.map(entry => entry.job)).toEqual(['OptimizeStorageImageJob', 'TagStorageMediaJob'])
    expect(dispatched[0]?.payload).toEqual({ disk: 'public', path: 'photo.png' })

    const recorded = (await store.tasksUnder('public', '')).get('photo.png')
    expect(recorded?.every(task => task.state === 'queued')).toBeTrue()
  })

  test('dispatches nothing for a content type with no work', async () => {
    await manager.disk('public').write('notes.pdf', 'x')

    expect(await dispatchDashboardFileTasks({ path: 'notes.pdf', contentType: 'application/pdf' }, manager, store, dispatch)).toEqual([])
    expect(dispatched).toEqual([])
    expect(await store.tasksUnder('public', '')).toEqual(new Map())
  })

  test('holds a transcode back until it has a profile to build a ladder from', async () => {
    // A job that guesses the source dimensions builds renditions nobody asked
    // for. Tagging still runs, because it needs nothing.
    await manager.disk('public').write('clip.mp4', 'x')

    const withoutProfile = await dispatchDashboardFileTasks({ path: 'clip.mp4', contentType: 'video/mp4' }, manager, store, dispatch)
    expect(withoutProfile.map(task => task.kind)).toEqual(['tag'])

    dispatched = []
    const withProfile = await dispatchDashboardFileTasks(
      { path: 'clip.mp4', contentType: 'video/mp4', videoProfile: { width: 1920, height: 1080 } },
      manager,
      store,
      dispatch,
    )
    expect(withProfile.map(task => task.kind)).toEqual(['transcode', 'tag'])
    expect(dispatched[0]?.payload.profile).toEqual({ width: 1920, height: 1080 })
  })

  test('records a failure when the queue refuses, rather than losing the work', async () => {
    // The whole reason the state is in a table the dashboard reads: a queue
    // that is down should leave a visible failure, not a file that silently
    // never gets processed.
    await manager.disk('public').write('photo.png', 'x')

    const tasks = await dispatchDashboardFileTasks(
      { path: 'photo.png', contentType: 'image/png' },
      manager,
      store,
      async () => { throw new Error('queue unavailable') },
    )

    expect(tasks.every(task => task.state === 'failed')).toBeTrue()
    expect(tasks[0]?.error).toBe('queue unavailable')
  })

  test('narrows to the kinds asked for', async () => {
    await manager.disk('public').write('photo.png', 'x')

    const tasks = await dispatchDashboardFileTasks(
      { path: 'photo.png', contentType: 'image/png', only: ['tag'] },
      manager,
      store,
      dispatch,
    )

    expect(tasks.map(task => task.kind)).toEqual(['tag'])
    expect(dispatched.map(entry => entry.job)).toEqual(['TagStorageMediaJob'])
  })
})

describe('runTask', () => {
  test('moves a task through running to done, counting the attempt', async () => {
    await store.writeTask('public', 'a.png', { kind: 'optimize', state: 'queued', attempts: 0 })

    const result = await runTask(store, 'public', 'a.png', 'optimize', async () => 'built')
    expect(result).toBe('built')

    const task = (await store.tasksUnder('public', '')).get('a.png')?.[0]
    expect(task?.state).toBe('done')
    expect(task?.attempts).toBe(1)
    expect(task?.startedAt).toBeTruthy()
    expect(task?.finishedAt).toBeTruthy()
  })

  test('records the failure and rethrows, so the queue still retries', async () => {
    // The row and the queue answer different questions: the queue decides
    // whether to try again, the row is what somebody looking at the file sees.
    expect(runTask(store, 'public', 'a.png', 'optimize', async () => {
      throw new Error('decode failed')
    })).rejects.toThrow('decode failed')

    await Bun.sleep(0)
    const task = (await store.tasksUnder('public', '')).get('a.png')?.[0]
    expect(task?.state).toBe('failed')
    expect(task?.error).toBe('decode failed')
  })

  test('a retry that succeeds clears the previous error', async () => {
    // A green file carrying a red message from two attempts ago is worse than
    // no message.
    await runTask(store, 'public', 'a.png', 'optimize', async () => { throw new Error('transient') }).catch(() => {})
    await runTask(store, 'public', 'a.png', 'optimize', async () => 'ok')

    const task = (await store.tasksUnder('public', '')).get('a.png')?.[0]
    expect(task?.state).toBe('done')
    expect(task?.error).toBeUndefined()
    expect(task?.attempts).toBe(2)
  })
})

describe('describeError', () => {
  test('bounds what can reach the column', () => {
    expect(describeError(new Error('boom'))).toBe('boom')
    expect(describeError('a string')).toBe('a string')
    expect(describeError(new Error('x'.repeat(5000)))).toHaveLength(2000)
  })
})

describe('the snapshot reports processing', () => {
  test('a queued file shows as queued, and names its tasks', async () => {
    await manager.disk('public').write('photo.png', 'x')
    await dispatchDashboardFileTasks({ path: 'photo.png', contentType: 'image/png' }, manager, store, dispatch)

    const snapshot = await getDashboardFileSnapshot({}, manager, store)
    const node = nodeAt(snapshot.root, 'photo.png')

    expect(node?.processing).toBe('queued')
    expect(node?.tasks.map(task => task.kind)).toEqual(['optimize', 'tag'])
  })

  test('a file nobody processed reports null, not done', async () => {
    await manager.disk('public').write('notes.txt', 'x')

    const snapshot = await getDashboardFileSnapshot({}, manager, store)
    expect(nodeAt(snapshot.root, 'notes.txt')?.processing).toBeNull()
  })
})

describe('tasks follow the file', () => {
  test('a rename carries them, so a finished transcode is not lost', async () => {
    await manager.disk('public').write('clip.mp4', 'x')
    await store.writeTask('public', 'clip.mp4', { kind: 'transcode', state: 'done', attempts: 1 })

    await renameDashboardFile({ path: 'clip.mp4', name: 'final.mp4' }, manager, store)

    const tasks = await store.tasksUnder('public', '')
    expect(tasks.get('clip.mp4')).toBeUndefined()
    expect(tasks.get('final.mp4')?.[0]?.state).toBe('done')
  })

  test('a folder rename carries the tasks beneath it', async () => {
    await manager.disk('public').write('media/clip.mp4', 'x')
    await store.writeTask('public', 'media/clip.mp4', { kind: 'transcode', state: 'done', attempts: 1 })

    await renameDashboardFile({ path: 'media', name: 'video' }, manager, store)

    expect((await store.tasksUnder('public', '')).has('video/clip.mp4')).toBeTrue()
  })

  test('a delete forgets them', async () => {
    await manager.disk('public').write('clip.mp4', 'x')
    await store.writeTask('public', 'clip.mp4', { kind: 'transcode', state: 'done', attempts: 1 })

    await deleteDashboardFile({ path: 'clip.mp4' }, manager, store)

    expect(await store.tasksUnder('public', '')).toEqual(new Map())
  })

  test('a completed listing sweeps the ones whose file is gone', async () => {
    await manager.disk('public').write('a.txt', 'x')
    await store.writeTask('public', 'gone.png', { kind: 'optimize', state: 'done', attempts: 1 })

    await getDashboardFileSnapshot({}, manager, store)

    expect((await store.tasksUnder('public', '')).has('gone.png')).toBeFalse()
  })
})

describe('reprocessDashboardFile', () => {
  test('re-runs every kind the file calls for', async () => {
    await manager.disk('public').write('photo.png', 'x')
    await store.writeTask('public', 'photo.png', { kind: 'optimize', state: 'failed', attempts: 3, error: 'old' })

    const result = await reprocessDashboardFile({ path: 'photo.png' }, manager, store, dispatch)

    expect(result.tasks.map(task => task.kind)).toEqual(['optimize', 'tag'])
    // The failed task is reset to queued rather than left showing its old
    // error beside a job that is about to run.
    const optimize = (await store.tasksUnder('public', '')).get('photo.png')?.find(task => task.kind === 'optimize')
    expect(optimize?.state).toBe('queued')
    expect(optimize?.error).toBeUndefined()
  })

  test('re-runs one kind when asked, leaving the others as they were', async () => {
    await manager.disk('public').write('photo.png', 'x')
    await store.writeTask('public', 'photo.png', { kind: 'optimize', state: 'done', attempts: 1 })

    await reprocessDashboardFile({ path: 'photo.png', kinds: ['tag'] }, manager, store, dispatch)

    expect(dispatched.map(entry => entry.job)).toEqual(['TagStorageMediaJob'])
    const optimize = (await store.tasksUnder('public', '')).get('photo.png')?.find(task => task.kind === 'optimize')
    expect(optimize?.state).toBe('done')
  })

  test('404s for a file that is gone, rather than queueing work against nothing', async () => {
    expect(reprocessDashboardFile({ path: 'missing.png' }, manager, store, dispatch))
      .rejects.toThrow(/was not found/)
  })

  test('rejects a kind that is not one of the three', async () => {
    await manager.disk('public').write('photo.png', 'x')

    expect(reprocessDashboardFile({ path: 'photo.png', kinds: ['reticulate'] }, manager, store, dispatch))
      .rejects.toThrow(/Unknown task kind/)
    expect(reprocessDashboardFile({ path: 'photo.png', kinds: 'tag' }, manager, store, dispatch))
      .rejects.toThrow(/must be an array/)
  })
})
