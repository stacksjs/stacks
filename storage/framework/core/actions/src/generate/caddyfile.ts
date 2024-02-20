import os from 'node:os'
import { logger } from '@stacksjs/logging'
import { findStacksProjects } from '@stacksjs/utils'

logger.log('Generating Local Reverse Proxy...')

const options = { quiet: true }
const projects = await findStacksProjects(os.homedir(), options)

// TODO: need to generate one caddyfile that can be used for all projects on the system (each projects gets its own *.localhost domain)
// TODO: need to create a watcher
// TODO: need to create an action that can be run to add a new project
// TODO: need to an action that checks whether there are an env port clashes aross projects

console.log(projects)

// const caddyfile = `stacksjs.localhost {
// 	route {
//     @

// 		@libs {
// 			path /libs/*
// 		}

// 		handle @libs {
// 			reverse_proxy localhost:3003
// 		}

// 		@api {
// 			path /api/*
// 		}

// 		handle @api {
// 			reverse_proxy localhost:3999
// 		}

// 		handle {
// 			reverse_proxy localhost:3000
// 		}
// 	}
// }`

// await storage.writeFile(p.frameworkPath('types/actions.d.ts'), caddyfile)
