import { describe, expect, test } from 'bun:test'
import { REPO_ROOT, serverCommand, serverEnvironment } from '../routing/runtime'
import { targetById } from '../routing/targets'
import { measureListenProcess } from './listen-process'

const PEER_TARGETS = ['stacks', 'stacks-minimal', 'elysia', 'express', 'fastify', 'hono', 'bun-raw'] as const

describe('peer server readiness handshake', () => {
  test('binds an ephemeral port and serves the exact shared response', async () => {
    for (const id of PEER_TARGETS) {
      const target = targetById(id)!
      const measurement = await measureListenProcess({
        command: serverCommand(target.server),
        cwd: REPO_ROOT,
        env: {
          ...serverEnvironment(target, false, 'static-json'),
          BENCH_PORT: '0',
          BENCH_READY_HANDSHAKE: '1',
        },
        path: '/bench/json',
        expectedBody: '{"hello":"world"}',
      })
      expect(measurement.listenMs, id).toBeGreaterThan(0)
      expect(measurement.firstResponseMs, id).toBeGreaterThanOrEqual(measurement.listenMs)
      expect(measurement.response, id).toEqual({
        status: 200,
        mediaType: 'application/json',
        bodySha256: '93a23971a914e5eacbf0a8d25154cda309c3c1c72fbb9914d47c60f3cb681588',
      })
    }
  }, 30_000)
})
