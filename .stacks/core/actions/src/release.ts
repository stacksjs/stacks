#!/usr/bin/env node
import { frameworkPath, projectPath } from '@stacksjs/path'
import { runAction } from '@stacksjs/actions'
import { runNpmScript } from '@stacksjs/utils'
import { NpmScript } from '@stacksjs/types'
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
// eslint-disable-next-line no-console
console.log('here2')
await runNpmScript(NpmScript.LintFix, { cwd: projectPath() })
await runNpmScript(NpmScript.Release, { debug: true, cwd: frameworkPath() })

// ok('Release complete')
