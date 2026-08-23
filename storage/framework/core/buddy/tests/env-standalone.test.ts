import { describe, expect, it } from 'bun:test'
import { shouldSkipAppKeyCheck } from '../src/project-setup'

/**
 * `buddy env:*` runs outside a Stacks application.
 *
 * It reads and writes an encrypted `.env` file and touches nothing else. It
 * needs no application key — it is *how* a key gets set — and no scaffolded
 * project, because a repository with credentials to keep is not necessarily an
 * app. Without this, `bunx @stacksjs/buddy env:get` answered
 *
 *     This command must be run inside a Stacks project
 *
 * anywhere it was most useful, and every project that wanted Stacks' env
 * encryption without the framework wrote its own wrapper around the same
 * `@stacksjs/env` functions the command already calls.
 */
describe('env commands outside a Stacks project', () => {
  it('needs no application key', () => {
    for (const command of ['env', 'env:get', 'env:set', 'env:encrypt', 'env:decrypt', 'env:keypair', 'env:rotate', 'env:check'])
      expect(shouldSkipAppKeyCheck(command)).toBeTrue()
  })

  it('and the exemption is by prefix, so a new env subcommand inherits it', () => {
    // The list matches `env` and anything under `env:`; a command added to
    // `env.ts` tomorrow should not have to be added here as well.
    expect(shouldSkipAppKeyCheck('env:something-new')).toBeTrue()
  })

  it('without exempting commands that only start with the same letters', () => {
    // `environment:*` is not `env:*`. The prefix rule matches on the colon.
    expect(shouldSkipAppKeyCheck('environment')).toBeFalse()
  })
})
