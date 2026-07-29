import { describe, expect, it } from 'bun:test'
import { parseActionSource, parseCommandSource } from './source-inventory'

describe('dashboard source inventory', () => {
  it('extracts native Action metadata', () => {
    const item = parseActionSource(`
      export default new Action({
        name: 'PublishPostAction',
        description: 'Publishes a post.',
        method: 'POST',
        async handle() {},
      })
    `, 'app/Actions/PublishPostAction.ts', 'Application')

    expect(item).toMatchObject({
      name: 'PublishPostAction',
      description: 'Publishes a post.',
      method: 'POST',
      origin: 'Application',
    })
  })

  it('ignores helper modules that are not Actions', () => {
    expect(parseActionSource('export function normalize() {}', 'helper.ts', 'Framework')).toBeNull()
  })

  it('extracts registered command metadata without executing it', () => {
    const item = parseCommandSource(`
      cli
        .command('publish', 'Publish the application')
        .option('--force, -f', 'Skip confirmation')
        .alias('ship')
    `, 'app/Commands/Publish.ts', 'publish', ['deploy'])

    expect(item).toMatchObject({
      name: 'publish',
      description: 'Publish the application',
      aliases: ['deploy', 'ship'],
      options: ['--force, -f'],
    })
  })
})
