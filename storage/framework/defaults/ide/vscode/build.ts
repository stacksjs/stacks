/**
 * Builds the extension into dist/:
 *
 *   extension.js                the extension, for VS Code's Node host; only `vscode` is external
 *   pickier-worker.js           the Bun process that runs the project's pickier (src/pickier-worker.ts)
 *   pickier-worker.bunfig.toml  an empty bunfig, so the worker skips the project's preloads
 *   stx/                        grammar, language configuration and snippets from @stacksjs/stx-vscode
 *   stx-typescript-plugin/      the stx TypeScript server plugin from @stacksjs/stx-vscode
 *
 * `vsce package` runs this first (`vscode:prepublish`), and `files` in
 * package.json ships exactly these. tsserver loads the plugin from
 * node_modules, so a forwarder to it is written there as well, which is what
 * a development host (`--extensionDevelopmentPath`) loads; scripts/package.ts
 * adds the same forwarder to the VSIX (see scripts/ts-plugin.ts).
 */
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import process from 'node:process'
import { copyTsPlugin, tsPluginName, writeTsPluginForwarder } from './scripts/ts-plugin'

const here = import.meta.dir
const dist = join(here, 'dist')

rmSync(dist, { recursive: true, force: true })
mkdirSync(dist, { recursive: true })

const builds = await Promise.all([
  // bunfig stays out: the stx utility-class engine imports it only to load a
  // config file, which the extension never asks for, and its module-scope
  // `await` and `import.meta.require` would make the CommonJS bundle a syntax
  // error in VS Code's Node host. tests/build.test.ts parses the bundle.
  Bun.build({ entrypoints: [join(here, 'src/extension.ts')], outdir: dist, target: 'node', format: 'cjs', external: ['vscode', 'bunfig'], minify: true }),
  Bun.build({ entrypoints: [join(here, 'src/pickier-worker.ts')], outdir: dist, target: 'bun', format: 'esm' }),
])

for (const build of builds) {
  if (!build.success) {
    console.error(build.logs)
    process.exit(1)
  }
}

writeFileSync(join(dist, 'pickier-worker.bunfig.toml'), '# Intentionally empty: the pickier worker must not run the project\'s bunfig preloads.\n')

const stxAssets = join(dirname(Bun.resolveSync('@stacksjs/stx-vscode/contributes.json', here)), 'assets')
cpSync(stxAssets, join(dist, 'stx'), { recursive: true })

copyTsPlugin(here)
const { version } = JSON.parse(readFileSync(join(here, 'package.json'), 'utf8'))
writeTsPluginForwarder(here, tsPluginName(here), version)

console.log('Built dist/')
