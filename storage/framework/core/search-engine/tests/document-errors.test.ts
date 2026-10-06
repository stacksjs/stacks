import { describe, expect, test } from 'bun:test'
import { listIndexSettings } from '../src/documents/index-list'

/**
 * A failure comes back as an Err, not as a TypeError.
 *
 * The catch variable in `listIndexSettings` and `flushModelDocuments` was
 * named `err`, hiding the `err` helper, so `return err(err)` called the
 * caught Error as a function. The command calling them read `result.isErr`
 * and never got the chance: it got an exception about `err` not being a
 * function instead of the reason the model could not be read.
 */
describe('search document helpers', () => {
  test('listIndexSettings() for a model that does not exist resolves to an Err', async () => {
    const result = await listIndexSettings('DefinitelyNotAModel')

    expect(result.isErr).toBe(true)
    if (result.isErr)
      expect(result.error).toContain('DefinitelyNotAModel')
  })
})
