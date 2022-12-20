#!/usr/bin/env node
import { frameworkPath } from '@stacksjs/path'
import { runActions } from '@stacksjs/actions'
// import { Action } from '@stacksjs/types'
// import { log } from '@stacksjs/cli'

await runActions([
  // Action.GeneratePackageJsons, // generate the package.json's for each package
  // Action.LintFix, // ensure there are no lint errors
  // Action.Release, // bump the versions, generate the changelog, and push the changes/tag
], { debug: true, cwd: frameworkPath() })

// log.success('Successfully released the Stacks framework')
