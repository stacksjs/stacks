#!/usr/bin/env bun
import { log } from '@stacksjs/cli'
import { existsSync } from 'node:fs'
import { execSync, spawnSync } from 'node:child_process'

log.info('Checking Code Style...')

const cwd = process.cwd()
const lintableFile = /\.(?:ts|js|json|md|yaml|yml)$/i
const ignoredPath = /(?:^|\/)(?:node_modules|dist|pantry|storage\/framework\/cache|\.git|\.stx|\.stx-serve)(?:\/|$)/

function trackedFiles(): string[] {
  try {
    return execSync('git ls-files -z', { cwd, encoding: 'utf8' })
      .split('\0')
      .filter(file => lintableFile.test(file) && !ignoredPath.test(file))
  }
  catch {
    return []
  }
}

const files = trackedFiles()
if (!files.length) {
  log.success('Linted')
  process.exit(0)
}

const configArgs = existsSync(`${cwd}/pickier.config.ts`)
  ? ['--config', 'pickier.config.ts']
  : []
const batchSize = 120
let failed = false

for (let i = 0; i < files.length; i += batchSize) {
  const batch = files.slice(i, i + batchSize)
  const result = spawnSync(
    'bunx',
    ['--bun', 'pickier', 'lint', ...batch, ...configArgs, '--max-warnings', '9999'],
    { cwd, stdio: 'inherit' },
  )

  if (result.status !== 0)
    failed = true
}

if (failed)
  process.exit(1)

log.success('Linted')
