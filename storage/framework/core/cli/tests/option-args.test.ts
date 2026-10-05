import { describe, expect, it } from 'bun:test'
import { join } from 'node:path'
import { buddyOptionArgs, runCommand } from '../src'

/**
 * Options travel from a buddy command to its action process as argv.
 *
 * `runAction` joined them into one string and `runCommand` splits a string on
 * whitespace without a shell, so a value with a space arrived in pieces:
 * `--address-line1 '12 St James Sq'` became `addressLine1: '12'` plus stray
 * arguments. Asserted through a real child process, because the bug is
 * invisible to anything that only inspects the string that was built.
 */
async function roundTrip(options: Record<string, unknown>): Promise<{ options: Record<string, unknown>, argv: string[] }> {
  const result = await runCommand(['bun', join(import.meta.dir, 'fixtures/print-options.ts'), ...buddyOptionArgs(options)], { stdout: 'pipe', stderr: 'pipe' } as any)
  if (result.isErr)
    throw result.error
  const stdout = await new Response(result.value.stdout as ReadableStream).text()
  return JSON.parse(stdout.trim().split('\n').pop()!)
}

describe('buddyOptionArgs', () => {
  it('keeps a value with spaces as one argument', async () => {
    const { options } = await roundTrip({ addressLine1: '12 St James Sq', city: 'London' })

    expect(options.addressLine1).toBe('12 St James Sq')
    expect(options.city).toBe('London')
  })

  it('passes true as a bare flag and leaves false out', () => {
    expect(buddyOptionArgs({ fresh: true, verbose: false, yes: undefined, project: null })).toEqual(['--fresh'])
  })

  it('does not send runner settings as flags', () => {
    expect(buddyOptionArgs({ env: { A: '1' }, stdout: { pipe: true }, domain: 'example.com' })).toEqual(['--domain', 'example.com'])
  })

  it('leaves out cac\'s own bookkeeping keys', () => {
    expect(buddyOptionArgs({ '--': ['x'], '_': ['y'], 'bump': 'patch' })).toEqual(['--bump', 'patch'])
  })

  it('sends the string false, which an action reads back as false', async () => {
    const { options } = await roundTrip({ privacy: 'false' })

    expect(options.privacy).toBe(false)
  })
})
