import { $ } from 'bun'
import process from 'node:process'
import { log } from '@stacksjs/logging'
import { findStacksProjects } from '@stacksjs/utils'

const projects = await findStacksProjects(undefined, { quiet: true })

log.debug('Running `buddy ports`')
log.debug(`Found ${projects.length} projects`)
log.debug('Projects:', projects)

// need to loop over the projects and then trigger `buddy ports` for each project (which returns a list of ports)
for (const project of projects) {
  log.debug('Running `buddy ports`')
  log.debug('Project:', project)

  // this right now causes a loop of the same project
  $.cwd(project)
  const ports = await $`./buddy ports --project ${project} --quiet`.text()

  console.log('ports', ports)
}

process.exit(0)
// then we can check if the port is in use and if it is, we can prompt the user to kill the process or to auto assign a new port
// if the port is not in use, we can start the project
