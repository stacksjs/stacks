import os from 'node:os'
import { findStacksProjects } from '@stacksjs/utils'
import { log } from '@stacksjs/logging'

const startDirectory = os.homedir()

try {
  // Usage example, assuming log is defined and works similarly to console
  const projects = await findStacksProjects(startDirectory)

  if (projects.length > 0) {
    log.info('Found Projects:')
    // eslint-disable-next-line no-console
    projects.forEach(project => console.log(`   - ${project}`))
  }
  else {
  // eslint-disable-next-line no-console
    console.log('No Stacks Projects found.')
  }
}
catch (error: any) {
  console.error('Error searching for Stacks projects:', error)
}
