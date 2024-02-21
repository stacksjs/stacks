import { runCommand } from '@stacksjs/cli'
import { findStacksProjects } from '@stacksjs/utils'
import process from 'node:process'

const projects = await findStacksProjects(undefined, { quiet: true })

// eslint-disable-next-line no-console
console.log('projects', projects)

// need to loop over the projects and then trigger `buddy ports` for each project (which returns a list of ports)
for (const project of projects) {
  // eslint-disable-next-line no-console
  console.log('project', project)
  // this right now causes a loop of the same project
  const ports = await runCommand(`buddy ports --project ${project}`)
  // eslint-disable-next-line no-console
  console.log('proj', project)
  // eslint-disable-next-line no-console
  console.log('ports', ports)
}

process.exit(0)
// then we can check if the port is in use and if it is, we can prompt the user to kill the process or to auto assign a new port
// if the port is not in use, we can start the project
