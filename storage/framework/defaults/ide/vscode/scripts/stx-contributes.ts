/**
 * Keeps the stx half of package.json's `contributes` equal to what
 * `@stacksjs/stx-vscode` ships.
 *
 * VS Code reads languages, grammars, commands and settings only from the
 * manifest, so the built-in stx support needs them declared here, pointing at
 * dist/stx/ (copied there by build.ts). The library describes them in
 * `contributes.json`; this derives the manifest from it rather than keeping a
 * second copy by hand. Snippets are left out on purpose: the extension offers
 * them as completions only when the stx extension is not installed, because
 * a manifest entry would show every snippet twice next to it.
 *
 *   bun scripts/stx-contributes.ts --write   update package.json (`bun run sync:stx`)
 *
 * tests/manifest.test.ts fails while the two disagree.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'

export interface StxContributes {
  languages: Array<Record<string, unknown> & { id: string, configuration: string }>
  grammars: Array<Record<string, unknown> & { language: string, path: string }>
  commands: Array<{ command: string, title: string, category?: string }>
  configuration: { title: string, properties: Record<string, unknown> }
}

const STX_DIR = './dist/stx/'

function fromStx(path: string): string {
  return STX_DIR + path.replace(/^\.\//, '')
}

/** `manifest` with its stx contributions replaced by the library's. */
export function withStxContributes(manifest: any, stx: StxContributes): any {
  const stxCommands = new Set(stx.commands.map(command => command.command))
  const contributes = manifest.contributes
  const sections: Array<{ title: string }> = Array.isArray(contributes.configuration) ? contributes.configuration : [contributes.configuration]

  return {
    ...manifest,
    contributes: {
      ...contributes,
      languages: stx.languages.map(language => ({ ...language, configuration: fromStx(language.configuration) })),
      grammars: stx.grammars.map(grammar => ({ ...grammar, path: fromStx(grammar.path) })),
      commands: [...contributes.commands.filter((command: { command: string }) => !stxCommands.has(command.command)), ...stx.commands],
      configuration: [...sections.filter(section => section.title !== stx.configuration.title), stx.configuration],
    },
  }
}

export function libraryContributes(root: string): StxContributes {
  return JSON.parse(readFileSync(Bun.resolveSync('@stacksjs/stx-vscode/contributes.json', root), 'utf8'))
}

if (import.meta.main) {
  const root = join(import.meta.dir, '..')
  const path = join(root, 'package.json')
  const manifest = JSON.parse(readFileSync(path, 'utf8'))
  const next = `${JSON.stringify(withStxContributes(manifest, libraryContributes(root)), null, 2)}\n`

  if (process.argv.includes('--write'))
    writeFileSync(path, next)
  else
    process.stdout.write(next)
}
