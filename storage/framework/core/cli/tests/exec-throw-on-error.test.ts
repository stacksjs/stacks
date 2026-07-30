// `execSync` and non-zero exit codes.
//
// `execSync` returns the child's stdout and, until now, nothing else. It never
// read `proc.exitCode`, and the `onExit` handler it hands to `Bun.spawnSync`
// only logs at debug and cannot propagate an exception by design. So a command
// that FAILED was indistinguishable from one that succeeded and printed
// nothing.
//
// That is not academic. `bump.ts` runs the whole tail of a release through this
// (`git add --all`, `git commit`, `git tag`, `git push`, `git push origin
// vX.Y.Z`). Every one of those could be rejected and `release.ts` would still
// print "Successfully released", leaving the operator believing a version had
// shipped when nothing was published and a bogus local tag had been created.
//
// The default stays non-throwing: 34 call sites relied on it, and changing all
// of them blind would trade a silent failure for a noisy regression.

import { describe, expect, it } from 'bun:test'
import { execSync } from '../src/exec'

describe('execSync', () => {
  it('still returns stdout on success', async () => {
    const out = await execSync(['echo', 'hello'], { stdout: 'pipe', stderr: 'pipe' })
    expect(out.trim()).toBe('hello')
  })

  it('stays silent on failure by default, preserving existing callers', async () => {
    // Deliberately pinned: the other 33 call sites depend on this, so a change
    // here should be a conscious decision rather than a side effect.
    const out = await execSync(['sh', '-c', 'exit 3'], { stdout: 'pipe', stderr: 'pipe' })
    expect(out).toBe('')
  })

  it('throws on a non-zero exit when asked', async () => {
    let threw = false
    try {
      await execSync(['sh', '-c', 'exit 3'], { stdout: 'pipe', stderr: 'pipe', throwOnError: true })
    }
    catch (error) {
      threw = true
      expect((error as Error).message).toContain('exit code 3')
    }
    expect(threw).toBe(true)
  })

  it('names the command that failed', async () => {
    // The release path runs five git commands in a row; "a command failed" would
    // not tell an operator which one.
    try {
      await execSync(['sh', '-c', 'exit 1'], { stdout: 'pipe', stderr: 'pipe', throwOnError: true })
      throw new Error('should not reach here')
    }
    catch (error) {
      expect((error as Error).message).toContain('sh -c exit 1')
    }
  })

  it('includes the child stderr, which is where git explains a rejection', async () => {
    try {
      await execSync(['sh', '-c', 'echo "rejected: behind remote" >&2; exit 1'], {
        stdout: 'pipe',
        stderr: 'pipe',
        throwOnError: true,
      })
      throw new Error('should not reach here')
    }
    catch (error) {
      expect((error as Error).message).toContain('rejected: behind remote')
    }
  })

  it('does not throw on success even when throwOnError is set', async () => {
    const out = await execSync(['echo', 'fine'], { stdout: 'pipe', stderr: 'pipe', throwOnError: true })
    expect(out.trim()).toBe('fine')
  })
})
