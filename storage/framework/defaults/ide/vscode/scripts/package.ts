/**
 * Package (and with `--publish`, publish) the extension.
 *
 *   bun scripts/package.ts [--out <file.vsix>] [--publish]
 *
 * `vsce package --no-dependencies` keeps the VSIX to what `files` lists, and it
 * leaves out everything under node_modules - including the one package the
 * extension needs there: the stx TypeScript server plugin, which tsserver will
 * only load by package name from `<extension>/node_modules` (see ts-plugin.ts).
 * So its forwarder is added to the VSIX after vsce writes it, and a publish
 * uploads that VSIX rather than letting vsce package a second time.
 */
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { TS_PLUGIN_DIST, tsPluginModuleDir, tsPluginName, writeTsPluginForwarder } from './ts-plugin'

const ROOT = join(import.meta.dir, '..')

function run(command: string[], cwd = ROOT, capture = false): string {
  const result = Bun.spawnSync(command, { cwd, stdout: capture ? 'pipe' : 'inherit', stderr: 'inherit', env: process.env })
  if (result.exitCode !== 0)
    throw new Error(`${command.join(' ')} exited with ${result.exitCode}`)
  return capture ? String(result.stdout ?? '') : ''
}

/** Build the VSIX at `out`, with the TypeScript plugin's forwarder in it. */
export function packageExtension(out: string): string {
  const manifest = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
  const name = tsPluginName(ROOT)

  // vsce runs `vscode:prepublish` (the build) first.
  run(['bun', 'x', '--bun', 'vsce', 'package', '--no-dependencies', '--out', out])

  // A staging tree whose layout is the VSIX's, so zip records the paths VS
  // Code extracts: extension/node_modules/<package>/...
  const stage = mkdtempSync(join(tmpdir(), 'stacks-vsix-'))
  try {
    writeTsPluginForwarder(join(stage, 'extension'), name, manifest.version)
    run(['zip', '-q', '-r', '-X', '-D', out, `extension/${tsPluginModuleDir(name)}`], stage)
  }
  finally {
    rmSync(stage, { recursive: true, force: true })
  }

  const listing = run(['unzip', '-Z1', out], ROOT, true).split('\n')
  for (const file of [`extension/${tsPluginModuleDir(name)}/index.js`, `extension/${TS_PLUGIN_DIST}/index.js`, `extension/${TS_PLUGIN_DIST}/typescript-stx-plugin.js`]) {
    if (!listing.includes(file))
      throw new Error(`${out} is missing ${file}`)
  }

  return out
}

if (import.meta.main) {
  const args = process.argv.slice(2)
  const outFlag = args.indexOf('--out')
  const manifest = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
  const out = resolve(outFlag === -1 ? join(ROOT, `${manifest.name}-${manifest.version}.vsix`) : args[outFlag + 1]!)

  packageExtension(out)
  console.log(`Packaged ${out}`)

  if (args.includes('--publish')) {
    if (!existsSync(out))
      throw new Error(`${out} was not written`)
    run(['bun', 'x', '--bun', 'vsce', 'publish', '--packagePath', out])
    console.log(`Published ${manifest.publisher}.${manifest.name}@${manifest.version}`)
  }
}
