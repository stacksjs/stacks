import { describe, expect, it } from 'bun:test'
import { runCommand, runProcess } from '../src'

/**
 * `exec` set stdout to whatever stdin was whenever stdin was set, and
 * `runCommand` always sets stdin. So asking for `stdout: 'pipe'` was ignored,
 * `runProcess` - which asks through `stdio` - never piped either, and callers
 * that needed a command's output went around both with `Bun.spawn`.
 */
async function output(stream: unknown): Promise<string> {
  return (await new Response(stream as ReadableStream).text()).trim()
}

describe('exec streams', () => {
  it('pipes stdout when runCommand asks for it', async () => {
    const result = await runCommand(['bun', '-e', 'console.log("piped")'], { stdout: 'pipe' } as any)

    expect(result.isOk).toBe(true)
    expect(await output(result.isOk && result.value.stdout)).toBe('piped')
  })

  it('pipes stdout and stderr through runProcess', async () => {
    const result = await runProcess(['bun', '-e', 'console.log("out"); console.error("err")'])

    expect(result.isOk).toBe(true)
    if (result.isOk) {
      expect(await output(result.value.stdout)).toBe('out')
      expect(await output(result.value.stderr)).toBe('err')
    }
  })

  it('keeps stdout piped independently of a piped stdin', async () => {
    const result = await runCommand(['bun', '-e', 'process.stdin.on("data", d => process.stdout.write(String(d).toUpperCase()))'], {
      stdin: 'pipe',
      input: 'hello',
      stdout: 'pipe',
    } as any)

    expect(result.isOk).toBe(true)
    expect(await output(result.isOk && result.value.stdout)).toBe('HELLO')
  })
})
