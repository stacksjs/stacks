// Kept in its own module, free of configuration, so the migration helpers that
// only need to read SQL can import it without evaluating `migrations.ts`, which
// captures the database settings at import time.

/**
 * Split a migration file into its statements.
 *
 * Comments come out FIRST, before the split on `;`. Splitting first and then
 * dropping the chunks that begin with `--` looks equivalent and is not: a
 * file that opens with a comment header — which every hand-written migration
 * in this repo does — glues that header to its first statement, so the chunk
 * begins with `--` and the statement disappears with the comment. Everything
 * downstream then reasons about a file it has only partly read, and the
 * ADD COLUMN reconciliation below would happily record a file as fully
 * applied while its first column had never been created.
 */
export function sqlStatementsOf(content: string): string[] {
  const statements: string[] = []
  let current = ''
  let quote: 'single' | 'double' | null = null
  let dollarTag: string | null = null

  for (let i = 0; i < content.length; i++) {
    const char = content[i]!

    // Inside a dollar-quoted body ($$ … $$ or $tag$ … $tag$) nothing is
    // punctuation: a `;` there belongs to the body. Without this a `DO $$ …
    // END $$;` block - which is the only way to write an idempotent
    // CREATE TYPE - is torn into fragments that are not valid SQL on their own.
    if (dollarTag) {
      current += char
      if (char === '$' && content.startsWith(dollarTag, i)) {
        current += content.slice(i + 1, i + dollarTag.length)
        i += dollarTag.length - 1
        dollarTag = null
      }
      continue
    }

    if (quote) {
      current += char
      if ((quote === 'single' && char === '\'') || (quote === 'double' && char === '"'))
        quote = null
      continue
    }

    // A comment runs to the end of the line, but only outside a string: a `--`
    // inside a default value is data.
    if (char === '-' && content[i + 1] === '-') {
      const newline = content.indexOf('\n', i)
      if (newline === -1)
        break
      i = newline - 1
      continue
    }

    const dollar = char === '$' ? /^\$[A-Za-z_]*\$/.exec(content.slice(i)) : null
    if (dollar) {
      dollarTag = dollar[0]
      current += dollarTag
      i += dollarTag.length - 1
      continue
    }

    if (char === '\'') {
      quote = 'single'
      current += char
      continue
    }

    if (char === '"') {
      quote = 'double'
      current += char
      continue
    }

    if (char === ';') {
      const trimmed = current.trim()
      if (trimmed.length > 0)
        statements.push(trimmed)
      current = ''
      continue
    }

    current += char
  }

  const trailing = current.trim()
  if (trailing.length > 0)
    statements.push(trailing)

  return statements
}
