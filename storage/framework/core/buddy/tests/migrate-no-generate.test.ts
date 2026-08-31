import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * `buddy migrate --no-generate` applies committed migrations and derives none.
 *
 * `buddy migrate` generates SQL from the models and then applies it, which is
 * right locally — models are the source of truth, and the generated file is
 * something you read before committing it.
 *
 * It is wrong on a deploy. Generating on the box means the schema reaching
 * production is whatever the model diff produces *there*, which is not
 * necessarily the SQL anybody reviewed: a diff can pick a column type, a
 * nullability or a default that nobody looked at. Observed in an app whose
 * model declared a 0-to-1 score — the generated column came out `INTEGER`,
 * which stores 0.6 as 0, and the generated file covered two of the four new
 * columns. Had that run on production first it would have been the schema.
 *
 * These assert the wiring rather than the migration engine: that the flag
 * exists, that it crosses the action-subprocess boundary the same way
 * `--from-db` and `--no-rename` do, and that the action honours it.
 */

const root = join(import.meta.dir, '../../../../..')

function read(relative: string): string {
  return readFileSync(join(root, relative), 'utf8')
}

describe('buddy migrate --no-generate', () => {
  const command = () => read('storage/framework/core/buddy/src/commands/migrate.ts')
  const action = () => read('storage/framework/core/actions/src/migrate/database.ts')

  it('is offered as a flag on the migrate command', () => {
    expect(command()).toContain(`.option('--no-generate'`)
  })

  it('crosses the subprocess boundary by env, like the other migrate flags', () => {
    // The action runs in a child process, so a flag that is only ever read
    // from `options` never reaches it. `--from-db` and `--no-rename` are
    // threaded through `process.env` for this reason and this follows them.
    const source = command()
    expect(source).toContain('STACKS_MIGRATE_NO_GENERATE')
    expect(source).toContain('options.generate === false')
  })

  it('sets the variable only when the flag is passed', () => {
    // cac gives `generate: true` by default for a `--no-x` option, so keying
    // off truthiness would disable generation on every ordinary `buddy
    // migrate` — turning the local workflow inside out.
    const source = command()
    const guard = source.slice(source.indexOf('STACKS_MIGRATE_NO_GENERATE') - 200, source.indexOf('STACKS_MIGRATE_NO_GENERATE'))
    expect(guard).toContain('=== false')
  })

  it('is honoured by the action that generates and applies', () => {
    const source = action()
    expect(source).toContain('STACKS_MIGRATE_NO_GENERATE')
    // Generation is skipped; applying is not.
    expect(source).toContain('runDatabaseMigration()')
  })

  it('still generates by default', () => {
    // Models being the source of truth is the point of the local workflow, so
    // the flag has to be opt-in.
    const source = action()
    const index = source.indexOf('const generated =')
    expect(source.slice(index, index + 120)).toContain('skipGeneration ?')
  })
})
