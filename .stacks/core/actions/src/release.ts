#!/usr/bin/env node
import { frameworkPath } from '@stacksjs/path'
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

await runAction('generate-package-json')
await runNpmScript(NpmScript.LintFix, { debug: true, cwd: frameworkPath() })
await runNpmScript(NpmScript.Release, { debug: true, cwd: frameworkPath() })
