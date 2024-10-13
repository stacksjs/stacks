#!/usr/bin/env bun
import { app } from '@stacksjs/config'
import { Action } from '@stacksjs/enums'
import { log } from '@stacksjs/logging'
import { projectPath } from '@stacksjs/path'
import { runActions } from '.'

await runActions(
  [
    Action.GenerateLibraryEntries, // generates the package/library entry points
    Action.LintFix, // ensure there are no lint errors
    // Action.Test, // run the tests
    Action.Bump, // bump the versions, create the git tag, generate the changelog, commit & push the changes
  ],
  {
    // debug mode needs to be enabled to see the output due to the interactive prompts
    cwd: projectPath(),
  },
)

log.success(`Successfully released ${app.name}`)
