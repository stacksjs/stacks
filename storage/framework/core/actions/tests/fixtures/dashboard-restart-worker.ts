import process from 'node:process'
import { runDashboardSupervisor } from '../../src/dev/dashboard-supervisor'
import { installServeRelayWorker, serveRelayPort } from '../../src/helpers/serve-relay-worker'

if (process.env.STACKS_DASHBOARD_WORKER !== '1')
  process.exit(await runDashboardSupervisor(import.meta.path, []))

const instance = process.env.STACKS_DASHBOARD_INSTANCE!
installServeRelayWorker(() => process.exit(0))
if (await Bun.file('fail-dashboard').exists())
  throw new Error('Replacement dashboard failed at startup')
if (await Bun.file('dashboard-started').exists() && process.env.STACKS_DASHBOARD_TEST_HOLD_RESTART === '1') {
  await Bun.write('replacement-started', '')
  while (!await Bun.file('publish-dashboard').exists())
    await Bun.sleep(25)
}

Bun.serve({
  hostname: '127.0.0.1',
  port: serveRelayPort('dashboard')!,
  async fetch(request) {
    const path = new URL(request.url).pathname
    if (path === '/__buddy/dashboard-ready')
      return new Response(null, { status: 204, headers: { 'x-stacks-dashboard': instance } })
    if (path === '/slow') {
      await Bun.write('slow-request-started', '')
      while (!await Bun.file('complete-slow-request').exists())
        await Bun.sleep(25)
    }
    return new Response(instance)
  },
})
await Bun.write('dashboard-started', '')
process.send?.({
  type: 'stacks:dashboard-ready',
  instance,
  domain: null,
  url: `http://127.0.0.1:${process.env.STACKS_DASHBOARD_PUBLIC_PORT}`,
})
