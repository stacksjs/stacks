/**
 * What a failed deploy prints.
 *
 * `withDeployNotification` wraps the whole deploy handler so an outcome is
 * announced exactly once. Its failure branch used to notify and exit(1)
 * without printing anything, which meant a deploy that threw anywhere - a
 * missing token, an unreachable box, a config error - produced an empty
 * terminal and a bare exit code.
 *
 * That is not a hypothetical: `buddy deploy --prod --yes` in the statushq
 * project exited 1 with zero bytes on stdout and nothing on stderr but the
 * env banner, and the only way to see the cause was to patch the installed
 * package. A notification is not a substitute for printing: it goes to
 * whatever channel is configured, and a machine with none configured is
 * exactly the machine whose operator is watching the terminal.
 */
import { describe, expect, it } from 'bun:test'
import fs from 'node:fs'
import path from 'node:path'

const SOURCE = path.resolve(import.meta.dir, '../src/deploy-notify.ts')
const source = fs.readFileSync(SOURCE, 'utf8')

/** The body of the catch block in withDeployNotification. */
function failureBranch(): string {
  const wrapper = source.slice(source.indexOf('export function withDeployNotification'))
  const start = wrapper.indexOf('catch (error) {')
  expect(start, 'withDeployNotification must still have a failure branch').toBeGreaterThan(-1)

  return wrapper.slice(start, wrapper.indexOf('process.exit', start))
}

describe('a deploy that throws', () => {
  it('prints the reason before exiting', () => {
    const branch = failureBranch()

    expect(branch).toContain('log.error')
    // The message has to carry the error itself, not just "deploy failed".
    expect(branch).toMatch(/log\.error\([^)]*getDeployErrorMessage\(error\)/)
  })

  it('prints the reason BEFORE notifying, so a broken notifier cannot eat it', () => {
    const branch = failureBranch()

    expect(branch.indexOf('log.error')).toBeLessThan(branch.indexOf('notifyDeployOutcome'))
  })

  it('keeps the stack available behind --verbose', () => {
    expect(failureBranch()).toContain('log.debug(stack)')
  })
})

describe('the message builder', () => {
  it('handles the shapes that reach a catch block', async () => {
    // An Error with no message used to print "undefined", which is barely
    // better than the silence this replaced.
    const { getDeployErrorMessage } = await import('../src/deploy-notify')

    expect(getDeployErrorMessage(new Error('no Hetzner API token found'))).toBe('no Hetzner API token found')
    expect(getDeployErrorMessage('a thrown string')).toBe('a thrown string')
    expect(getDeployErrorMessage({ code: 'ENOENT' })).toContain('ENOENT')
    expect(getDeployErrorMessage(new Error(''))).toContain('no message')
    expect(getDeployErrorMessage(undefined)).toContain('no message')
  })
})
