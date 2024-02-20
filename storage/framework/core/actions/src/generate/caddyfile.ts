// checks for all of the Stacks projects on the system
// and generates one caddyfile for it all

// stacksjs.localhost {
//  route {
//    @libs {
//      path /libs/*
//    }

//    handle @libs {
//      reverse_proxy localhost:3003
//    }

//    @api {
//      path /api/*
//    }

//    handle @api {
//      reverse_proxy localhost:3999
//    }

//    handle {
//      reverse_proxy localhost:3000
//    }
//  }
// }

import { readdir } from 'node:fs/promises'
import { path as p } from '@stacksjs/path'
import { logger } from '@stacksjs/logging'
import { storage } from '@stacksjs/storage'
import { findProjects } from '@stacksjs/buddy'

logger.log('Generating Local Reverse Proxy...')

const projects = await findProjects()

const caddyfile = `stacksjs.localhost {
	route {
    @

		@libs {
			path /libs/*
		}

		handle @libs {
			reverse_proxy localhost:3003
		}

		@api {
			path /api/*
		}

		handle @api {
			reverse_proxy localhost:3999
		}


		handle {
			reverse_proxy localhost:3000
		}
	}
}`

await storage.writeFile(p.frameworkPath('types/actions.d.ts'), caddyfile)
