import process from 'node:process'
import { exec } from '../../src/exec'

async function main(): Promise<void> {
  const [directory, signal, enabled] = process.argv.slice(2)
  if (!directory || !['SIGINT', 'SIGTERM'].includes(signal || '')) throw new Error('Expected fixture directory and signal')
  // Model a supervising CLI's own drain handler, which waits for its child.
  process.on(signal!, () => {})
  const before = process.listenerCount(signal!)
  const child = `
  process.on(${JSON.stringify(signal)}, async () => {
    await Bun.write(${JSON.stringify(`${directory}/drained`)}, 'drained')
    process.exit(0)
  })
  await Bun.write(${JSON.stringify(`${directory}/child`)}, String(process.pid))
  setInterval(() => {}, 1000)
  `
  const result = await exec([process.execPath, '--no-env-file', '-e', child], { stdin: 'ignore', stdout: 'pipe', stderr: 'pipe', forwardSignals: enabled === 'true' })
  await Bun.write(`${directory}/result`, JSON.stringify({ ok: result.isOk, before, after: process.listenerCount(signal!) }))
  process.exit(result.isOk ? 0 : 1)
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
