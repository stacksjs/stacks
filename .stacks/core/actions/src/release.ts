#!/usr/bin/env node
import { frameworkPath } from '@stacksjs/path'
import { runActions } from '@stacksjs/actions'
import { Action } from '@stacksjs/types'
import { log } from '@stacksjs/cli'

const result = await runActions([
  Action.GeneratePackageJsons, // generate the package.json's for each package
  Action.LintFix, // ensure there are no lint errors
  Action.Release, // bump the versions, generate the changelog, and push the changes/tag
], { debug: true, cwd: frameworkPath() })

if (result.isErr()) {
  log.error('There was an error while releasing your stack.', result.error)
  process.exit()
}
