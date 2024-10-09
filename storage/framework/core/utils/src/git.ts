import { execSync } from 'node:child_process'
import { handleError } from '@stacksjs/error-handling'

export function isGitClean(): boolean {
  try {
    execSync('git diff-index --quiet HEAD --')
    return true
  }
  catch (error) {
    handleError(error)
    return false
  }
}
