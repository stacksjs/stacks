import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pantryLockViolations } from '../../storage/framework/core/actions/src/pantry-lock'

// Keep declaration validation independent of a platform's registry resolution.
const root = resolve(import.meta.dir, '../..')
const lock = readFileSync(resolve(root, 'pantry.lock'), 'utf8')
const bun = Bun.JSONC.parse(readFileSync(resolve(root, 'bun.lock'), 'utf8'))
const violations = pantryLockViolations(lock, null, bun.workspaces)
if (violations.length)
  throw new Error(`Pantry lock does not describe this workspace:\n${violations.join('\n')}`)
console.log('Pantry lock matches every current workspace declaration')
