import process from 'node:process'
import { clearProjectService, recordProjectService } from '../../../path/src/projects'
import { runDashboardSupervisor } from '../../src/dev/dashboard-supervisor'

if (process.env.STACKS_DASHBOARD_WORKER !== '1')
  process.exit(await runDashboardSupervisor(import.meta.path, []))

const root = process.cwd()
const pid = Number(process.env.STACKS_DASHBOARD_SUPERVISOR_PID)
if (Number(process.env.PORT_ADMIN) > 0) {
  // Stretch the handoff so the updater necessarily polls before the new
  // worker publishes its service record.
  clearProjectService(root, 'dashboard', pid)
  if (process.env.STACKS_DASHBOARD_TEST_HOLD_RESTART === '1') {
    while (!await Bun.file('publish-dashboard').exists())
      await Bun.sleep(25)
  }
  else {
    await Bun.sleep(450)
  }
}

const instance = crypto.randomUUID()
const server = Bun.serve({
  hostname: '127.0.0.1',
  port: Number(process.env.PORT_ADMIN),
  fetch: () => new Response(null, { status: 204, headers: { 'x-stacks-dashboard': instance } }),
})
recordProjectService(root, {
  name: 'dashboard',
  pid,
  port: server.port!,
  url: server.url.href,
  startedAt: new Date().toISOString(),
  restartInstance: instance,
})
process.on('SIGTERM', () => process.exit(0))
