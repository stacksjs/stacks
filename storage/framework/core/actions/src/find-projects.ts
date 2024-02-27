import process from 'node:process'
import { findStacksProjects } from '@stacksjs/utils'
import { log } from '@stacksjs/logging'
import { parseOptions } from '@stacksjs/cli'

try {
  const options = parseOptions()
  const projects = await findStacksProjects(undefined, options)

  if (projects.length > 0) {
    log.info('Found Projects:')
    // eslint-disable-next-line no-console
    projects.forEach(project => console.log(`   - ${project}`))
    process.exit()
  }

  log.info('No Stacks Projects found.')
}
catch (error: any) {
  log.error('Error searching for Stacks projects:', error)
}
