import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/** Canonical defaults are the source for both NPM and compiled Buddy scaffolds. */
export function generateNativeTemplates(root = join(import.meta.dir, '..')): void {
  const files = {
    '.github/workflows/buddy-bot.yml': 'vcs/github/workflows/buddy-bot.yml',
    'config/buddy-bot.ts': 'scaffold/config/buddy-bot.ts',
  }
  const templates = Object.fromEntries(Object.entries(files).map(([destination, source]) => [destination, readFileSync(join(root, '../../defaults', source), 'utf8').replaceAll('\r\n', '\n')]))
  writeFileSync(join(root, 'src/native-project-templates.ts'), `// Generated from canonical defaults by scripts/native-templates.ts.\nexport const nativeProjectTemplates: Record<string, string> = ${JSON.stringify(templates, null, 2)}\n`)
}
if (import.meta.main) generateNativeTemplates()
