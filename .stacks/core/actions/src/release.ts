#!/usr/bin/env node
import { frameworkPath } from '@stacksjs/path'
import { runAction } from '@stacksjs/actions'
import { runNpmScript } from '@stacksjs/utils'
import { NpmScript } from '@stacksjs/types'
import { log } from '@stacksjs/cli'

// first, lets generate the package.json's
let result = await runAction('generate-package-json')

if (result.isErr()) {
  log.error('There was an error while releasing your stack, during the process of fixing your lint errors.', result.error)
  process.exit()
}

// next, lets run lint:fix to make sure there are no lint errors
// because when "generate-package-json" runs, it generates some lint errors
result = await runNpmScript(NpmScript.LintFix, { debug: true, cwd: frameworkPath() })

if (result.isErr()) {
  log.error('There was an error while releasing your stack, during the process of fixing your lint errors.', result.error)
  process.exit()
}

// next, lets run the release script to bump the versions and generate the changelog, and push the changes
// ultimately, a successful git push will trigger the CI/CD release workflow
result = await runNpmScript(NpmScript.Release, { debug: true, cwd: frameworkPath() })

if (result.isErr()) {
  log.error('There was an error while releasing your stack.', result.error)
  process.exit()
}
