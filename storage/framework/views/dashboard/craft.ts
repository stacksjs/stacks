/**
 * Stacks Dashboard - Native Desktop Application
 *
 * This file launches the Stacks Dashboard as a native desktop app using Craft.
 * Run with: bun run craft.ts
 */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const DEV_URL = 'http://localhost:5173'
const PROD_URL = './dist/index.html'

const isDev = process.env.NODE_ENV !== 'production'

/**
 * Find the craft-minimal binary
 */
function findCraftBinary(): string {
  const possiblePaths = [
    // From Projects directory (sibling to stacks)
    join(process.cwd(), '../../../../craft/packages/zig/zig-out/bin/craft-minimal'),
    // Common locations
    '/Users/glennmichaeltorregosa/Documents/Projects/craft/packages/zig/zig-out/bin/craft-minimal',
    // Global install
    'craft-minimal',
  ]

  for (const path of possiblePaths) {
    if (path === 'craft-minimal') continue
    if (existsSync(path)) {
      return path
    }
  }

  throw new Error('Craft binary not found. Please build Craft first.')
}

async function launchDashboard() {
  const url = isDev ? DEV_URL : PROD_URL
  const craftPath = findCraftBinary()

  const args = [
    url,
    '--title', 'Stacks Dashboard',
    '--width', '1400',
    '--height', '900',
  ]

  if (isDev) {
    args.push('--hot-reload')
  }

  console.log(`Launching Stacks Dashboard...`)
  console.log(`URL: ${url}`)
  console.log(`Binary: ${craftPath}`)

  return new Promise<void>((resolve, reject) => {
    const proc = spawn(craftPath, args, {
      stdio: 'inherit',
    })

    proc.on('exit', (code) => {
      if (code === 0 || code === null) {
        resolve()
      } else {
        reject(new Error(`Craft exited with code ${code}`))
      }
    })

    proc.on('error', (error) => {
      reject(error)
    })
  })
}

launchDashboard().catch(console.error)
