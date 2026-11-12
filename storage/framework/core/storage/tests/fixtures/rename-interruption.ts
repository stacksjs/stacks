import { spyOn, test } from 'bun:test'
import { join } from 'node:path'
import { fs } from '../../src/fs'
import { rename } from '../../src/move'

test('process interruption immediately after the real backup rename', async () => {
  const root = process.env.STACKS_RENAME_INTERRUPTION_ROOT
  if (!root) throw new Error('The interruption fixture needs its owned root')
  const source = join(root, 'candidate'), destination = join(root, 'bundle'), native = fs.renameSync
  spyOn(fs, 'renameSync').mockImplementation((from, to) => {
    native(from, to)
    if (String(from) === destination && String(to).endsWith('/previous')) {
      console.log('INTERRUPTED_AFTER_BACKUP')
      process.exit(43)
    }
  })
  await rename(source, destination, { overwrite: true })
  throw new Error('The interruption boundary was not reached')
})
