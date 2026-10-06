/**
 * Boots the real ORM route generator inside whatever project the working
 * directory is, and prints the paths it registered. Used by
 * `model-api-selection.test.ts`, which runs it against a throwaway project.
 */
import process from 'node:process'
import { log } from '@stacksjs/logging/runtime'
import { route } from '@stacksjs/router'

await import('../../src/routes')

const paths = [...new Set((route.routes as Array<{ path: string }>).map(entry => entry.path))].sort()
console.log(JSON.stringify({ paths }))
// The generator's warnings are asynchronous; a server lives long enough to
// print them, a script that exits next does not.
await log.flush()
process.exit(0)
