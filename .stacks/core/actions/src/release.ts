#!/usr/bin/env node
import { frameworkPath } from '@stacksjs/path'
import { runActions } from '@stacksjs/actions'
import { Action } from '@stacksjs/types'
// import { log } from '@stacksjxs/cli'

await runActions([
  Action.GeneratePackageJsons, // generate the package.json's for each package
  Action.LintFix, // ensure there are no lint errors
  Action.Bump, // bump the versions, generate the changelog, and push the changes, including the git version tag
], { debug: true, cwd: frameworkPath() }) // debug mode needs to be enabled to see the output due to the interactive prompts

// log.success('Successfully released the Stacks framework')
