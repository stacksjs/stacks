import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { startTestService } from '../../../testing/src/service'

export const ownedRedisBinary = process.env.STACKS_TEST_REDIS_BINARY || Bun.which('redis-server') || undefined
export async function ownedRedisFixture() {
  if (!ownedRedisBinary) throw new Error('Set STACKS_TEST_REDIS_BINARY to an official Redis binary; shared Redis services are never used')
  const directory = await mkdtemp(resolve(tmpdir(), 'stacks-redis-invalidations-')), config = resolve(directory, 'bunfig.toml')
  await Bun.write(config, 'preload = []\n')
  let service: ReturnType<typeof startTestService> | undefined, port = 0
  async function start() {
    service = startTestService([process.execPath, `--config=${config}`, '--no-env-file', resolve(import.meta.dir, 'owned-redis-service.ts')], { label: 'Owned loopback Redis', cwd: resolve(import.meta.dir, '../..'), env: { ...process.env, STACKS_TEST_REDIS_BINARY: ownedRedisBinary, STACKS_TEST_REDIS_DIRECTORY: directory, STACKS_TEST_REDIS_PORT: String(port) }, startupTimeoutMs: 15000 })
    const state = await service.ready as { port: number, version: string }
    port = state.port
    return state
  }
  try {
    const state = await start()
    return { directory, config, url: `redis://127.0.0.1:${port}`, version: state.version, stop: async () => { await service?.stop(); service = undefined }, restart: start, close: async () => { await service?.stop(); service = undefined; await rm(directory, { recursive: true, force: true }) } }
  }
  catch (error) { await service?.stop(); await rm(directory, { recursive: true, force: true }); throw error }
}
