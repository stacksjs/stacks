import process from 'node:process'
import { Action } from '@stacksjs/actions'
import { checkApplicationHealth } from '@stacksjs/router'

export default new Action({
  name: 'DashboardHealthAction',
  description: 'Runs the native application dependency probes and returns runtime telemetry.',
  method: 'GET',
  apiResponse: true,

  async handle() {
    const startedAt = performance.now()
    const health = await checkApplicationHealth()
    const memory = process.memoryUsage()

    return {
      ...health,
      durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
      runtime: {
        bunVersion: process.versions.bun || '',
        nodeVersion: process.versions.node || '',
        platform: process.platform,
        architecture: process.arch,
        uptimeSeconds: Math.max(0, Math.floor(process.uptime())),
        residentMemoryBytes: memory.rss,
        heapUsedBytes: memory.heapUsed,
      },
    }
  },
})
