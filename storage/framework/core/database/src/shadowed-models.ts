/**
 * Refusing to generate a migration that drops a framework table's columns.
 *
 * An app can override a framework default by writing `app/Models/<Name>.ts`,
 * and that is a supported, useful thing to do. It is also a loaded gun, because
 * of how the two halves interact:
 *
 *   - The userland model wins completely. It is not merged with the default; it
 *     *replaces* it.
 *   - The migration generator treats the models as the truth. A column the
 *     surviving model does not declare is a column that should not exist, so it
 *     emits `ALTER TABLE ... DROP COLUMN`.
 *
 * Put together: somebody writes a model for their own idea of a `Release`,
 * unaware that the framework ships one on a `releases` table, and the generated
 * migration drops `version`, `status` and `notes` - while the framework's own
 * dashboard actions go on selecting them. The migration applies cleanly and
 * reports success. Nothing says a word until a page that has always worked
 * starts failing on a missing column.
 *
 * That happened, and the only reason it was caught was somebody reading the
 * generated SQL before applying it. So it is refused here instead, with the
 * two ways out named: pick a different table, or `buddy publish:model <Name>`
 * to start from the default and add to it.
 *
 * Only *drops on a shadowed table* are refused. Adding columns to an overridden
 * model, or overriding a model onto a table of your own, is untouched - those
 * are the cases the override mechanism exists for.
 */

import type { ShadowedModel } from './model-sources'
import { readFileSync } from 'node:fs'
import process from 'node:process'

export interface ShadowedDrop {
  /** The model whose userland version shadows a framework default. */
  model: string
  /** The table both of them declare. */
  table: string
  /** Columns the migration would drop. */
  columns: string[]
}

/** The escape hatch, for somebody who means it. */
export const ALLOW_SHADOW_DROPS_ENV = 'STACKS_ALLOW_SHADOW_DROPS'

export function shadowDropsAllowed(): boolean {
  return process.env[ALLOW_SHADOW_DROPS_ENV] === '1'
}

/**
 * The table a model declares.
 *
 * Read out of the source rather than by importing it. Importing a model at
 * generate time means executing arbitrary userland code to answer a question
 * about a string literal, and the failure mode - a model that throws on import
 * silently disabling the guard - is exactly the sort of quiet hole this exists
 * to close.
 */
export function declaredTable(file: string): string | null {
  let source: string
  try {
    source = readFileSync(file, 'utf8')
  }
  catch {
    return null
  }

  const match = /\btable\s*:\s*['"`]([^'"`]+)['"`]/.exec(source)

  return match ? match[1]! : null
}

/** A `DROP COLUMN` statement, as every dialect writes it. */
const DROP_COLUMN = /^\s*ALTER\s+TABLE\s+["`']?([\w.$]+)["`']?\s+DROP\s+(?:COLUMN\s+)?["`']?([\w$]+)["`']?/i

/**
 * Which of the generated statements drop a column from a table that a userland
 * model took over from a framework default.
 *
 * Matched on the *table*, not on the model name. A userland `Release` on its own
 * `repo_releases` table shares nothing with the framework's `releases` and is
 * not this function's business; a userland model that happens to be called
 * something else but lands on `releases` very much is - which is why the
 * framework side is what supplies the table.
 */
export function findShadowedColumnDrops(
  statements: readonly string[],
  shadowed: readonly ShadowedModel[],
): ShadowedDrop[] {
  if (shadowed.length === 0 || statements.length === 0)
    return []

  const byTable = new Map<string, { model: string, columns: string[] }>()

  for (const model of shadowed) {
    const frameworkTable = declaredTable(model.frameworkFile)
    const userTable = declaredTable(model.userFile)

    // Different tables is the harmless case, and the recommended way out of the
    // harmful one.
    if (!frameworkTable || frameworkTable !== userTable)
      continue

    byTable.set(frameworkTable, { model: model.name, columns: [] })
  }

  if (byTable.size === 0)
    return []

  for (const statement of statements) {
    const match = DROP_COLUMN.exec(statement)
    if (!match)
      continue

    const entry = byTable.get(match[1]!)
    if (entry && !entry.columns.includes(match[2]!))
      entry.columns.push(match[2]!)
  }

  return [...byTable.entries()]
    .filter(([, entry]) => entry.columns.length > 0)
    .map(([table, entry]) => ({ model: entry.model, table, columns: entry.columns }))
}

/**
 * The message somebody sees, which is the whole point of the guard.
 *
 * It names the columns, because "a destructive change was detected" sends
 * people to read generated SQL, and it names both ways out, because the right
 * one depends on what they were trying to do and only they know that.
 */
export function shadowedDropMessage(drops: readonly ShadowedDrop[]): string {
  const lines = drops.map((drop) => {
    const columns = drop.columns.map(column => `\`${column}\``).join(', ')

    return `  - \`app/Models/${drop.model}.ts\` overrides the framework's \`${drop.model}\` model on the `
      + `\`${drop.table}\` table, and would drop ${columns}.`
  })

  const [first] = drops

  return [
    'Refusing to generate migrations: a model in app/Models/ would drop columns from a framework table.',
    '',
    ...lines,
    '',
    'A userland model replaces a framework default entirely rather than extending it, so every column',
    'the framework declared and yours does not is dropped - while the framework\'s own code goes on',
    'reading them. The migration applies cleanly and nothing fails until a page that has always worked',
    'stops finding a column.',
    '',
    'Two ways out:',
    '',
    `  1. Start from the default and add to it:  buddy publish:model ${first?.model ?? '<Name>'}`,
    `     That copies the framework's definition into app/Models/, so nothing is lost by writing yours.`,
    '',
    '  2. Give your model its own table, if it is a different thing that happens to share a name.',
    '',
    `If you truly mean to drop those columns, re-run with ${ALLOW_SHADOW_DROPS_ENV}=1.`,
  ].join('\n')
}
