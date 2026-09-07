import { describe, expect, it } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * A command that exits non-zero says so in the line it closes with.
 *
 * `outro` reports success unless told otherwise - by a third argument carrying
 * the error, or by `type`. Twenty commands ended in `process.exit(FatalError)`
 * immediately after an outro that did neither, so `stx checks failed`,
 * `Failed to install stack`, `Could not add stack`, `Share failed` and a
 * production deploy's `reported a failure` all printed green.
 *
 * The exit code was right in every case, which is exactly why this survived: CI
 * reads the exit code and a person reads the line, and only one of them was
 * being told the truth.
 */

const dir = join(import.meta.dir, '..', 'src', 'commands')

function sources(): string[] {
  const files: string[] = []
  const walk = (d: string) => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, entry.name)
      if (entry.isDirectory()) walk(p)
      else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) files.push(p)
    }
  }
  walk(dir)
  return files
}

/** The call's argument count and body, given source starting at `outro(`. */
function callShape(from: string): { args: number, body: string, after: string } {
  let depth = 0
  let args = 1
  let end = 0
  for (let i = from.indexOf('('); i < from.length; i++) {
    const ch = from[i]
    if (ch === '(' || ch === '{' || ch === '[')
      depth++
    else if (ch === ')' || ch === '}' || ch === ']') {
      depth--
      if (depth === 0) {
        end = i
        break
      }
    }
    else if (ch === ',' && depth === 1) {
      args++
    }
  }
  const body = from.slice(0, end)
  // A trailing comma before the close is not another argument.
  if (/,\s*$/.test(body.slice(0, -1)))
    args--
  return { args, body, after: from.slice(end + 1) }
}

describe('a command that exits fatal', () => {
  it('does not close with a success line', () => {
    const green: string[] = []

    for (const file of sources()) {
      const lines = readFileSync(file, 'utf8').split('\n')
      for (const [index, line] of lines.entries()) {
        if (!/\bawait outro\(/.test(line))
          continue

        const window = lines.slice(index, index + 8).join('\n')
        const { args, body, after } = callShape(window.slice(window.indexOf('outro(')))

        // The fatal exit has to be the NEXT statement: a success line whose
        // window happens to contain the else-branch's exit is not this bug.
        if (!/^\s*process\.exit\(ExitCode\.FatalError\)/.test(after))
          continue

        // Three arguments means the third is the error, which outro already
        // reports as a failure.
        if (args >= 3 || /type:\s*'(error|warning)'/.test(body))
          continue

        green.push(`${file.slice(dir.length + 1)}:${index + 1}`)
      }
    }

    expect(green.sort()).toEqual([])
  })
})
