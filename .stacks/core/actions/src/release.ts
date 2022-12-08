#!/usr/bin/env node
import { frameworkPath } from '@stacksjs/path'
import { runAction } from '@stacksjs/actions'
import { runCommand } from '@stacksjs/cli'
// import { ok } from '@stacksjs/error-handling'

/**
 * Generate the needed package.json
 * Run lint:fix
 * Run bump
 * Run changelog
 */

// eslint-disable-next-line no-console
console.log('here')

await runAction('generate-package-json')
// await runCommand('lint:fix')
// eslint-disable-next-line no-console
console.log('here2')
await runCommand('bumpp ../package.json ./package.json ./core/**/package.json --execute \'pnpm run changelog\'', { debug: true, cwd: frameworkPath() })

// ok('Release complete')
