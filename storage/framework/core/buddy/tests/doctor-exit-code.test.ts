import { describe, expect, it } from 'bun:test'
import { cli } from '@stacksjs/cli'
import { doctor } from '../src/commands/doctor'

// Guards stacksjs/stacks#1957: `buddy doctor` must exit 1 on failures by
// default (gating CI / upgrades), and only exit 0 when `--no-fail` is
// explicitly passed. The regression this locks in: declaring the negated
// `--no-fail` option with `{ default: false }` forces `options.fail` to
// `false` even when the flag is absent, so the `options?.fail !== false`
// exit-1 branch never fires. These tests parse argv through the REAL
// @stacksjs/cli command registration (no run) and assert the resolved
// `options.fail`, mirroring the exact branch condition in doctor.ts.
describe('buddy doctor --no-fail exit-code contract', () => {
  // The summary in doctor.ts gates `process.exit(1)` on this exact expression.
  const wouldExit1 = (options: { fail?: boolean }) => options?.fail !== false

  async function parseDoctor(argv: string[]): Promise<{ fail?: boolean }> {
    const buddy = cli('buddy')
    doctor(buddy)
    const parsed = await buddy.parse(['node', 'buddy', ...argv], { run: false })
    return parsed.options as { fail?: boolean }
  }

  it('exits 1 on failure by default (no flag)', async () => {
    const options = await parseDoctor(['doctor'])
    // With `{ default: false }` present this is `false` (the bug) — must be `true`.
    expect(options.fail).toBe(true)
    expect(wouldExit1(options)).toBe(true)
  })

  it('exits 0 with --no-fail', async () => {
    const options = await parseDoctor(['doctor', '--no-fail'])
    expect(options.fail).toBe(false)
    expect(wouldExit1(options)).toBe(false)
  })
})
