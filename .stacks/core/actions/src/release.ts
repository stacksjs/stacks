#!/usr/bin/env node
import { frameworkPath } from '@stacksjs/path'
import { runActions } from '@stacksjs/actions'
import { Action } from '@stacksjs/types'

// import { log } from '@stacksjxs/cli'

await runActions([
  Action.GeneratePackageJsons, // generate the package.json's for each package
  Action.LintFix, // ensure there are no lint errors
  // Action.Test, // run the tests
  Action.Bump, // bump the versions, create the git (version) tag, generate the changelog, commit & push the changes
], { verbose: true, cwd: frameworkPath(), shell: true }) // debug mode needs to be enabled to see the output due to the interactive prompts

// log.success('Successfully released the Stacks framework')
