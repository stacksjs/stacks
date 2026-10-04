/**
 * Keeps the stx half of package.json's `contributes` equal to what
 * `@stacksjs/stx-vscode` ships.
 *
 * VS Code reads languages, grammars, commands and settings only from the
 * manifest, so the built-in stx support needs them declared here, pointing at
 * dist/stx/ (copied there by build.ts). The library describes them in
 * `contributes.json`; this derives the manifest from it rather than keeping a
 * second copy by hand. That includes the TypeScript server plugin entry, which
 * type-checks `.stx` files (see ts-plugin.ts). Snippets are left out on purpose: the extension offers
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
  typescriptServerPlugins: Array<Record<string, unknown> & { name: string, languages?: string[] }>
}

const STX_DIR = './dist/stx/'

function fromStx(path: string): string {
  return STX_DIR + path.replace(/^\.\//, '')
}

/** The namespace of the extension's own commands; every other one is stx's. */
export const OWN_COMMAND_PREFIX = 'stacks.'

/**
 * `manifest` with its stx contributions replaced by the library's.
 *
 * Commands are told apart by namespace, not by the library's current list: a
 * command stx renamed or dropped is no longer in that list, and filtering by
 * it kept the old entry as if it were this extension's own (`css.reload`
 * outlived its rename to `stx.reloadUtilityClasses` that way).
 */
export function withStxContributes(manifest: any, stx: StxContributes): any {
  const contributes = manifest.contributes
  const sections: Array<{ title: string }> = Array.isArray(contributes.configuration) ? contributes.configuration : [contributes.configuration]

  return {
    ...manifest,
    contributes: {
      ...contributes,
      languages: stx.languages.map(language => ({ ...language, configuration: fromStx(language.configuration) })),
      grammars: stx.grammars.map(grammar => ({ ...grammar, path: fromStx(grammar.path) })),
      commands: [...contributes.commands.filter((command: { command: string }) => command.command.startsWith(OWN_COMMAND_PREFIX)), ...stx.commands],
      configuration: [...sections.filter(section => section.title !== stx.configuration.title), stx.configuration],
      typescriptServerPlugins: stx.typescriptServerPlugins,
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
