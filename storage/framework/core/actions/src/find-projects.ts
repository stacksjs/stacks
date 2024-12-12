import process from 'node:process'
import { parseOptions } from '@stacksjs/cli'
import { log } from '@stacksjs/logging'
import { findStacksProjects } from '@stacksjs/utils'

try {
  const options = parseOptions()
  const projects = await findStacksProjects(undefined, options)

  if (projects.length > 0) {
    log.info('Found Projects:')
    projects.forEach((project: string) => console.log(`   - ${project}`))
    process.exit()
  }

  log.info('No Stacks Projects found.')
}
catch (error: any) {
  log.error('Error searching for Stacks projects:', error)
}
