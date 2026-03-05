import process from 'node:process'
import { parseOptions } from '@stacksjs/cli'
import { log } from '@stacksjs/logging'
import { ExitCode } from '@stacksjs/types'
import { findStacksProjects } from '@stacksjs/utils'

try {
  const options = parseOptions()
  const projects = await findStacksProjects(undefined, options)

  if (projects.length > 0) {
    log.info('Found Projects:')
    projects.forEach((project: string) => console.log(`   - ${project}`))
    process.exit(ExitCode.Success)
  }

  log.info('No Stacks Projects found.')
}
catch (error: any) {
  log.error('Error searching for Stacks projects:', error)
}
