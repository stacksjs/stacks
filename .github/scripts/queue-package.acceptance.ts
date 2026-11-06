import { expect, test } from 'bun:test'
import { mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { publicationEnvironment } from '../../storage/framework/core/actions/tests/helpers/publication-environment'

test('the built queue declarations compile for a consumer without source aliases', async () => {
  const checkout = resolve(import.meta.dir, '../..')
  const directory = await mkdtemp(join(tmpdir(), 'stacks-queue-types-'))
  try {
    await symlink(join(checkout, 'node_modules'), join(directory, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir')
    await writeFile(join(directory, 'tsconfig.json'), JSON.stringify({
      compilerOptions: { module: 'preserve', moduleResolution: 'bundler', target: 'esnext', strict: true, skipLibCheck: true, types: [], noEmit: true },
      files: ['consumer.ts'],
    }))
    await writeFile(join(directory, 'consumer.ts'), `
import { aggregateWorkerMetrics, type WorkerSnapshot } from '@stacksjs/queue'
const snapshots: WorkerSnapshot[] = []
const metrics = aggregateWorkerMetrics(snapshots)
const completed: number = metrics.counts.completed
const failed: number = metrics.counts.failed
const throughput: number = metrics.throughputPerMinute
const duration: number = metrics.averageDuration
export const values = [completed, failed, throughput, duration]
`)
    const child = Bun.spawn([join(checkout, 'node_modules/.bin/tsc'), '-p', join(directory, 'tsconfig.json')], {
      cwd: directory, env: publicationEnvironment(), stdout: 'pipe', stderr: 'pipe', timeout: 30_000,
    })
    const [code, out, error] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
    expect(code, out + error).toBe(0)
  }
  finally { await rm(directory, { recursive: true, force: true }) }
}, 40_000)
