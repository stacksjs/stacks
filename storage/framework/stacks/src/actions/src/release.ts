#!/usr/bin/env bun
import { frameworkPath } from 'src/path/src'
import { Action } from 'src/enums/src'
import { log } from 'src/logging/src'
import { runActions } from '.'
import app from '~/config/app'

await runActions([
  Action.GenerateLibraryEntries, // generates the package/library entry points
  Action.LintFix, // ensure there are no lint errors
  // Action.Test, // run the tests
  Action.Bump, // bump the versions, create the git tag, generate the changelog, commit & push the changes
], { verbose: true, cwd: frameworkPath() }) // debug mode needs to be enabled to see the output due to the interactive prompts

log.success(`Successfully released ${app.name}`)
