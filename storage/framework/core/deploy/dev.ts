/**
 * Development Server Module
 *
 * Handles development server with hot reload and deployment capabilities.
 */

import { deployFrontend, buildFrontend } from './deploy'
import { watch } from 'node:fs'
import { join } from 'node:path'

export interface DevServerOptions {
  environment: string
  region: string
  port?: number
  host?: string
  autoDeploy?: boolean
  watchPaths?: string[]
}

/**
 * Start development server with deployment capabilities
 */
export async function startDevServer(options: DevServerOptions): Promise<void> {
  const {
    environment = 'development',
    region = 'us-east-1',
    port = 3000,
    host = 'localhost',
    autoDeploy = false,
    watchPaths = ['src'],
  } = options

  console.log('🔧 Starting development server...')
  console.log(`   Host: http://${host}:${port}`)
  console.log(`   Environment: ${environment}`)
  console.log(`   Auto-deploy: ${autoDeploy ? 'enabled' : 'disabled'}\n`)

  // Start the development server using Bun
  const server = Bun.serve({
    port,
    hostname: host,
    async fetch(req) {
      const url = new URL(req.url)
      const path = url.pathname

      // Serve static files from dist directory
      const filePath = join(process.cwd(), 'dist', path === '/' ? 'index.html' : path)

      try {
        const file = Bun.file(filePath)
        const exists = await file.exists()

        if (exists) {
          return new Response(file)
        }

        // Fall back to index.html for SPA routing
        const indexFile = Bun.file(join(process.cwd(), 'dist', 'index.html'))
        if (await indexFile.exists()) {
          return new Response(indexFile)
        }

        return new Response('Not found', { status: 404 })
      } catch (error) {
        return new Response(`Error: ${error}`, { status: 500 })
      }
    },
    error(error) {
      return new Response(`Error: ${error}`, { status: 500 })
    },
  })

  console.log(`✅ Server started at http://${server.hostname}:${server.port}`)

  // Watch for changes if auto-deploy is enabled
  if (autoDeploy) {
    console.log('\n👀 Watching for changes...')

    for (const watchPath of watchPaths) {
      const fullPath = join(process.cwd(), watchPath)

      watch(fullPath, { recursive: true }, async (eventType, filename) => {
        if (filename && eventType === 'change') {
          console.log(`\n📝 File changed: ${filename}`)
          console.log('🔄 Rebuilding and deploying...')

          try {
            await buildFrontend()
            await deployFrontend({ environment, region })
            console.log('✅ Deployed successfully\n')
          } catch (error) {
            console.error('❌ Deployment failed:', error)
          }
        }
      })
    }
  }

  console.log('\n📋 Available commands:')
  console.log('   Press Ctrl+C to stop the server')

  // Keep the process running
  await new Promise(() => {})
}

/**
 * Start development server and deploy on startup
 */
export async function startWithDeploy(options: DevServerOptions): Promise<void> {
  console.log('🚀 Building and deploying before starting dev server...\n')

  try {
    await buildFrontend()
    await deployFrontend({
      environment: options.environment,
      region: options.region,
    })
    console.log('\n')
  } catch (error) {
    console.error('⚠️  Initial deployment failed:', error)
    console.log('Continuing to start dev server...\n')
  }

  await startDevServer(options)
}
