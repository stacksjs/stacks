import { dts } from 'bun-plugin-dtsx'
import { intro, outro } from '../build/src'
import { version } from './package.json'

const { startTime } = await intro({
  dir: import.meta.dir,
})

const result = await Bun.build({
  entrypoints: [
    './src/index.ts',
    './src/cli.ts',
  ],

  outdir: './dist',
  format: 'esm',
  target: 'bun',
  // sourcemap: 'linked',
  minify: true,
  splitting: true,

  external: [
    '@stacksjs/ai',
    '@stacksjs/actions',
    '@stacksjs/enums',
    '@stacksjs/config',
    '@stacksjs/dns',
    '@stacksjs/error-handling',
    '@stacksjs/cli',
    '@stacksjs/cloud',
    '@stacksjs/logging',
    '@stacksjs/utils',
    '@stacksjs/validation',
    '@stacksjs/path',
    '@stacksjs/storage',
    '@stacksjs/types',
    'bun',
  ],

  plugins: [dts({ root: './src', outdir: './dist' })],
})

// Update the package.json workspace:* references to the specific version
const packageJsonPath = './package.json'
const packageJson = await Bun.file(packageJsonPath).json()

// Find all workspace:* dependencies in the main package.json and update them to use the current version
for (const section of ['dependencies', 'devDependencies', 'peerDependencies']) {
  if (!packageJson[section])
    continue

  for (const [dep, depVersion] of Object.entries(packageJson[section])) {
    // Update all workspace:* references to use the current version
    if (depVersion === 'workspace:*') {
      packageJson[section][dep] = `^${version}`
      console.log(`Updated ${dep} from 'workspace:*' to '^${version}'`)
    }
  }
}

// Write the updated package.json back to the file
await Bun.write(packageJsonPath, JSON.stringify(packageJson, null, 2))

await outro({
  dir: import.meta.dir,
  startTime,
  result,
})
