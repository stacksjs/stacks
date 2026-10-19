import { afterAll, beforeAll, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const output = new URL('../src/output.ts', import.meta.url).pathname
const payload = '航🌱é'.repeat(300000)
let directory: string
let script: string
let binary: string

beforeAll(async () => {
  const runtime = join(import.meta.dir, '../../../runtime')
  await mkdir(runtime, { recursive: true })
  directory = await mkdtemp(join(runtime, 'cli-output-'))
  script = join(directory, 'writer.ts')
  binary = join(directory, process.platform === 'win32' ? 'writer.exe' : 'writer')
  await writeFile(script, `
import { writeSync } from 'node:fs'
import { printAsync, printErrorAsync } from ${JSON.stringify(output)}
const mode = process.argv[2]
const diagnostic = mode.endsWith('stderr')
// Initializing Bun's stdio stream makes its pipe nonblocking, as CLI setup does.
const stream = diagnostic ? process.stderr : process.stdout
const print = diagnostic ? printErrorAsync : printAsync
if (mode.startsWith('broken')) {
  await new Response(Bun.stdin).text()
  const listeners = stream.listenerCount('error')
  try { await print('x'.repeat(1024 * 1024)); process.exit(90) }
  catch (error) {
    await new Promise(resolve => setImmediate(resolve))
    writeSync(diagnostic ? 1 : 2, JSON.stringify({ code: error.code, listeners, remaining: stream.listenerCount('error') }) + '\\n')
    process.exit(0)
  }
}
await print('%s', '航🌱é'.repeat(300000))
await print('done %d', 7)
process.exit(0)
`)
  const result = await Bun.build({
    entrypoints: [script], target: 'bun', minify: true,
    compile: { outfile: binary, autoloadBunfig: false, autoloadDotenv: false, autoloadTsconfig: false, autoloadPackageJson: false },
  })
  expect(result.success, result.logs.join('\n')).toBe(true)
}, 20000)

afterAll(async () => {
  if (directory) await rm(directory, { recursive: true, force: true })
})

for (const compiled of [false, true]) {
  for (const diagnostic of [false, true]) {
    const channel = diagnostic ? 'stderr' : 'stdout'
    const name = `${compiled ? 'compiled binary' : 'Bun process'} ${channel}`
    test(`${name} awaits complete Unicode output through a slow pipe before immediate exit`, async () => {
      const child = Bun.spawn([...(compiled ? [binary] : [process.execPath, '--no-env-file', script]), channel], { stdout: 'pipe', stderr: 'pipe' })
      const timeout = setTimeout(() => child.kill(), 10000)
      try {
        const stream = diagnostic ? child.stderr : child.stdout
        const other = new Response(diagnostic ? child.stdout : child.stderr).text()
        // Leave the real pipe undrained long enough to fill its kernel buffer.
        await Bun.sleep(100)
        const reader = stream.getReader()
        const chunks: Uint8Array[] = []
        try {
          while (true) {
            const { value, done } = await reader.read()
            if (done) break
            chunks.push(value)
            await Bun.sleep(1)
          }
        }
        finally { reader.releaseLock() }
        expect(await child.exited).toBe(0)
        expect(Buffer.concat(chunks).toString('utf8')).toBe(`${payload}\ndone 7\n`)
        expect(await other).toBe('')
      }
      finally { clearTimeout(timeout); child.kill() }
    }, 15000)

    test(`${name} rejects a broken pipe without leaving an error listener`, async () => {
      const child = Bun.spawn([...(compiled ? [binary] : [process.execPath, '--no-env-file', script]), `broken-${channel}`], { stdin: 'pipe', stdout: 'pipe', stderr: 'pipe' })
      const timeout = setTimeout(() => child.kill(), 10000)
      try {
        const stream = diagnostic ? child.stderr : child.stdout
        const report = new Response(diagnostic ? child.stdout : child.stderr).json()
        // Closing the read end before releasing stdin makes EPIPE deterministic.
        await stream.cancel()
        child.stdin.end()
        expect(await child.exited).toBe(0)
        const result = await report
        expect(result.code).toBe('EPIPE')
        expect(result.remaining).toBe(result.listeners)
      }
      finally { clearTimeout(timeout); child.kill() }
    }, 15000)
  }
}
