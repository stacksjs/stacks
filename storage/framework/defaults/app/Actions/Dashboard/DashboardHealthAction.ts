import process from 'node:process'
import { Action } from '@stacksjs/actions'
import { checkApplicationHealth } from '@stacksjs/router'
import { dashboardOperationalError, dashboardOperationalIssue } from './dashboard-response'

export default new Action({
  name: 'DashboardHealthAction',
  description: 'Runs the native application dependency probes and returns runtime telemetry.',
  method: 'GET',
  apiResponse: true,

  async handle() {
    const startedAt = performance.now()
    try {
      const health = await checkApplicationHealth()
      const memory = process.memoryUsage()
      const checks = Object.fromEntries(Object.entries(health.checks).map(([name, check]) => {
        if (!check.ok) {
          dashboardOperationalIssue(
            check.message,
            'Dependency probe failed.',
            `DashboardHealthAction.${name}`,
          )
        }
        return [name, {
          ...check,
          message: check.ok ? undefined : 'Dependency probe failed.',
        }]
      }))

      return {
        ...health,
        checks,
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
    }
    catch (error) {
      return dashboardOperationalError(error, 'System health could not be loaded.', 'DashboardHealthAction')
    }
  },
})
