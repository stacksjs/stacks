import { frameworkExternal, intro, outro, transpilePackage } from '../build/src'
import { version } from './package.json'

const { startTime } = await intro({
  dir: import.meta.dir,
})

// Transpile file-by-file rather than bundling. The CLI lazy-loads its
// commands through a name→path map (`import(cmd.path)` in lazy-commands.ts):
// Bun's bundler can't follow a variable dynamic import, so a 2-entrypoint
// bundle emitted only cli.js + index.js and every command except the
// statically-imported `setup` was missing from dist — `buddy deploy` (and dev,
// build, …) failed with "Command not found" for node_modules consumers.
// Transpiling every src file to a matching dist file makes the lazy imports
// resolve to their sibling `dist/commands/*.js`.
await transpilePackage({
  dir: import.meta.dir,
  external: frameworkExternal(['ts-security-crypto', 'bun-query-builder']),
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

// Ensure the published CLI entry starts with a shebang so it is directly
// executable (npm marks bin files executable when they begin with one).
// The transpiler drops any shebang from source, so re-add it post-build.
const cliPath = './dist/cli.js'
const cliSource = await Bun.file(cliPath).text()
if (!cliSource.startsWith('#!'))
  await Bun.write(cliPath, `#!/usr/bin/env bun\n${cliSource}`)

await outro({
  dir: import.meta.dir,
  startTime,
  result: { errors: [], warnings: [] },
})
