import { existsSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
const [role, directory, owner] = process.argv.slice(2)
if (!role || !directory || !owner) throw new Error('Owned process-tree fixture needs its role, private directory and owner token')
if (['root', 'early-exit', 'service', 'service-no-ready', 'service-early-exit'].includes(role)) {
  Bun.spawn([process.execPath, '--no-env-file', `--config=${join(directory, 'bunfig.toml')}`, import.meta.path, 'child', directory, owner], { stdin: 'ignore', stdout: 'ignore', stderr: 'ignore' })
  const deadline = performance.now() + 5000
  while (!['child', 'grandchild'].every(name => existsSync(join(directory, `${name}.json`)))) {
    if (performance.now() > deadline) throw new Error('Descendants did not become ready')
    await Bun.sleep(5)
  }
  process.stdout.write('owned tree ready\n')
  if (role.startsWith('service') && role !== 'service-no-ready') {
    const { notifyTestServiceReady } = await import(process.env.OWNED_SERVICE_MODULE || '../../src/service')
    await new Promise<void>((resolve, reject) => {
      if (!notifyTestServiceReady({ role, owner }, (error: Error | null) => error ? reject(error) : resolve()))
        reject(new Error('Owned service fixture has no readiness channel'))
    })
  }
  if (role === 'early-exit' || role === 'service-early-exit') process.exit(7)
  await Bun.sleep(60000)
}
else {
  if (role === 'child') Bun.spawn([process.execPath, '--no-env-file', `--config=${join(directory, 'bunfig.toml')}`, import.meta.path, 'grandchild', directory, owner], { stdin: 'ignore', stdout: 'ignore', stderr: 'ignore' })
  process.on('SIGTERM', () => {})
  const server = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch(request) {
    if (request.headers.get('x-fixture-owner') !== owner) return new Response('not owned', { status: 403 })
    if (new URL(request.url).pathname === '/stop') setTimeout(() => process.exit(0), 10)
    return Response.json({ role, owner })
  } })
  writeFileSync(join(directory, `${role}.json`), JSON.stringify({ origin: server.url.origin, owner, role }))
}
