#!/usr/bin/env node
import { runAction } from '@stacksjs/actions'
import { runCommand } from '@stacksjs/cli'

/**
 * Generate the needed package.json
 * Run lint:fix
 * Run bump
 * Run changelog
 */

await runAction('generate-package-json')
await runCommand('lint:fix')
await runCommand('bumpp ../package.json ./package.json ./core/**/package.json ../package.json --execute \'pnpm run changelog\'', { debug: true })
