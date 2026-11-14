import { RedisClient } from 'bun'
import { resolve } from 'node:path'
import { notifyTestServiceReady } from '../../../testing/src/service'

const binary = process.env.STACKS_TEST_REDIS_BINARY, directory = process.env.STACKS_TEST_REDIS_DIRECTORY
if (!binary || !directory?.includes('stacks-redis-invalidations-')) throw new Error('Owned Redis fixture binary and directory are required')
let port = Number(process.env.STACKS_TEST_REDIS_PORT || 0)
if (!port) { const reservation = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch: () => new Response(null) }); port = reservation.port!; reservation.stop(true) }
if (!Number.isSafeInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid owned Redis fixture port')
const child = Bun.spawn([binary, '--bind', '127.0.0.1', '--protected-mode', 'yes', '--port', String(port), '--save', '', '--appendonly', 'no', '--daemonize', 'no', '--dir', directory, '--logfile', resolve(directory, 'redis.log')], { cwd: directory, stdout: 'ignore', stderr: 'pipe' })
const errors = new Response(child.stderr).text()
let stopping: Promise<void> | undefined
function stop() { return stopping ??= (async () => { if (child.exitCode === null) child.kill('SIGTERM'); await child.exited })() }
process.once('SIGTERM', () => { void stop().finally(() => process.exit(0)) })
process.once('SIGINT', () => { void stop().finally(() => process.exit(0)) })
const deadline = Date.now() + 10000
let ready = false
try {
  while (Date.now() < deadline && child.exitCode === null) {
    const client = new RedisClient(`redis://127.0.0.1:${port}`, { autoReconnect: false, maxRetries: 0, enableOfflineQueue: false, connectionTimeout: 100 })
    client.onclose = () => {}
    try {
      await client.connect()
      const information = String(await client.send('INFO', ['server']))
      if (!information.includes(`process_id:${child.pid}\r\n`)) throw new Error('Port belongs to another Redis process')
      const version = /redis_version:([^\r\n]+)/.exec(information)?.[1]
      await new Promise<void>((resolve, reject) => { if (!notifyTestServiceReady({ port, version, redisPid: child.pid }, error => error ? reject(error) : resolve())) reject(new Error('Owned Redis requires its lifecycle owner')) })
      ready = true; break
    }
    catch { await Bun.sleep(10) }
    finally { client.close() }
  }
  if (!ready) { await stop(); throw new Error(`Owned Redis failed readiness (${child.exitCode}): ${(await errors).slice(-500)}`) }
  const code = await child.exited
  if (code !== 0) process.exitCode = code
}
finally { await stop() }
