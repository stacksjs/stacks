import { describe, expect, it } from 'bun:test'
import fs from 'node:fs'
import path from 'node:path'

/**
 * The mail reconcile step ships a shell script to the box inside a JS template
 * literal. That nesting has bitten twice, both times silently:
 *
 *   sed -i "s|acme:renew -d \"|acme:renew -d \"$MAILHOSTNAME,|" "$RENEW"
 *
 * `\"` inside a template literal is just `"`, so what reached the shell was
 * `sed -i "s|acme:renew -d "` — a complete quoted argument — followed by a bare
 * `|` the shell read as a pipe. sed got the unterminated expression
 * `s|acme:renew -d ` and exited non-zero, which under `set -e` aborted the whole
 * mail step: no mailbox reconcile, no DKIM report, no mail DNS. The deploy
 * printed one line about a sed expression and went on to report success.
 *
 * A backtick in a comment inside the same literal ends the string outright and
 * breaks the build instead — louder, but the same trap.
 *
 * `bash -n` would catch both, but the framework preloader in this repo closes
 * the descriptors `posix_spawn` needs, so a test here cannot shell out. These
 * tests tokenize the script with shell quoting rules instead and assert the
 * property that was violated: every `sed` s-command survives quoting intact.
 */

const SOURCE = path.resolve(import.meta.dir, '../src/commands/deploy.ts')

/**
 * Pull the shell scripts out of deploy.ts.
 *
 * The scan understands template-literal nesting: these scripts interpolate
 * expressions that are themselves template literals, so stopping at the first
 * backtick would truncate the script and lint a fragment. Interpolations become
 * an inert placeholder — this asserts the SHAPE of the script is valid for any
 * substitution, which is the property that broke.
 */
function shellScripts(): Array<{ start: number, body: string }> {
  const src = fs.readFileSync(SOURCE, 'utf8')
  const scripts: Array<{ start: number, body: string }> = []
  const marker = 'const script = `'

  let from = 0
  for (;;) {
    const open = src.indexOf(marker, from)
    if (open === -1)
      break

    const bodyStart = open + marker.length
    const out: string[] = []
    let i = bodyStart

    for (; i < src.length; i++) {
      const ch = src[i]

      if (ch === '\\') {
        out.push(src[i + 1] ?? '')
        i++
        continue
      }

      if (ch === '`')
        break

      if (ch === '$' && src[i + 1] === '{') {
        let depth = 1
        let j = i + 2
        for (; j < src.length && depth > 0; j++) {
          const c = src[j]
          if (c === '\\') { j++; continue }
          if (c === '{') { depth++ }
          else if (c === '}') { depth-- }
          else if (c === '`') {
            for (j++; j < src.length; j++) {
              if (src[j] === '\\') { j++; continue }
              if (src[j] === '`') break
            }
          }
        }
        out.push('PLACEHOLDER')
        i = j - 1
        continue
      }

      out.push(ch)
    }

    scripts.push({ start: src.slice(0, open).split('\n').length, body: out.join('') })
    from = i + 1
  }

  return scripts
}

/** Script body with shell comments dropped, so prose about a bug is not read as the bug. */
function code(body: string): string {
  return body.split('\n').filter(line => !line.trimStart().startsWith('#')).join('\n')
}

/**
 * Split one line into words the way the shell does, so a quoted `|` stays inside
 * its word and an unquoted one ends it. That is what makes the truncation
 * visible: the broken line yields `s|acme:renew -d ` as a whole word.
 */
function tokenize(line: string): string[] {
  const words: string[] = []
  let word = ''
  let quote: '"' | '\'' | null = null
  let started = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]

    if (ch === '\\' && quote !== '\'') {
      word += line[++i] ?? ''
      started = true
      continue
    }
    if (quote) {
      if (ch === quote)
        quote = null
      else
        word += ch
      continue
    }
    if (ch === '"' || ch === '\'') {
      quote = ch
      started = true
      continue
    }
    if (/\s/.test(ch) || ch === '|' || ch === ';' || ch === '&') {
      if (started) {
        words.push(word)
        word = ''
        started = false
      }
      continue
    }
    word += ch
    started = true
  }
  if (started)
    words.push(word)

  return words
}

/** A sed `s` expression needs its delimiter three times: s<d>find<d>replace<d>. */
function truncatedSedExpressions(line: string): string[] {
  const words = tokenize(line)
  if (!words.some(w => w === 'sed' || w.endsWith('/sed')))
    return []

  return words.filter((w) => {
    if (!/^s[^\w\s]/.test(w))
      return false
    const delim = w[1]
    return w.split(delim).length - 1 < 3
  })
}

describe('shell shipped by deploy.ts', () => {
  it('parses as TypeScript at all', () => {
    // A backtick inside one of the shell comments ends the template literal the
    // script lives in, and the build then fails tens of lines later with
    // "',' expected" pointing at shell prose. That has happened three times.
    // Bun's transpiler reproduces the parse in-process (this repo's preloader
    // makes spawning a compiler impossible from a test) and names the real line.
    //
    // Deliberately a parse rather than a scan for backticks: an ESCAPED backtick
    // in a shell comment is legal in the literal and inert in the shell, so a
    // textual scan flags correct code. Only the parser distinguishes the two.
    const transpiler = new Bun.Transpiler({ loader: 'ts' })
    expect(() => transpiler.transformSync(fs.readFileSync(SOURCE, 'utf8'))).not.toThrow()
  })

  it('finds the scripts to check', () => {
    expect(shellScripts().length).toBeGreaterThan(0)
  })

  it('extracts whole scripts, not fragments truncated at a nested backtick', () => {
    // A scanner that stopped at the first backtick returned ~25 bytes of the
    // mail script and silently linted nothing.
    expect(Math.max(...shellScripts().map(s => s.body.length))).toBeGreaterThan(1000)
  })

  it('no sed s-command is cut short by the surrounding quoting', () => {
    const offenders: string[] = []
    for (const { start, body } of shellScripts()) {
      for (const line of code(body).split('\n')) {
        for (const expr of truncatedSedExpressions(line))
          offenders.push(`deploy.ts:${start}: ${expr}`)
      }
    }

    expect(offenders).toEqual([])
  })

  it('the tokenizer actually detects the historical break', () => {
    // Guard the guard: if this stops failing, the check above has gone blind.
    const broken = 'sed -i "s|acme:renew -d "|acme:renew -d "$X,|" "$RENEW"'
    expect(truncatedSedExpressions(broken)).toEqual(['s|acme:renew -d '])

    const fixed = 'sed -i "s|acme:renew -d \\"|acme:renew -d \\"$X,|" "$RENEW"'
    expect(truncatedSedExpressions(fixed)).toEqual([])
  })
})

describe('the mail certificate step', () => {
  const src = fs.readFileSync(SOURCE, 'utf8')

  it('pins the output filename instead of depending on --domains order', () => {
    // tlsx names the certificate after the FIRST -d entry. The domain list here
    // is read back from the certificate, where openssl prints SANs sorted — so
    // without --cert-name the union lands on whichever hostname sorts first and
    // the mail server keeps reading the old file.
    expect(src).toContain('--cert-name "$CERTNAME"')
  })

  it('verifies the name landed before reporting success', () => {
    // CERTHOST used to be echoed on a zero exit alone, which reported "added to
    // the mail certificate" for an issuance that had written somewhere else.
    const block = src.slice(src.indexOf('acme:issue -d "$ALL"'))
    const certhost = block.indexOf('echo "CERTHOST:')
    const verify = block.indexOf('UPDATED=')

    expect(verify).toBeGreaterThan(-1)
    expect(verify).toBeLessThan(certhost)
  })

  it('keeps the previous certificate when issuance drops a name', () => {
    // This certificate serves other tenants; a partial result must not be what
    // they get.
    const block = src.slice(src.indexOf('acme:issue -d "$ALL"'))
    expect(block.slice(0, block.indexOf('echo "CERTHOST:'))).toContain('previous certificate kept')
  })

  it('does not splice hostnames into the scheduled renewal script', () => {
    // The renewal renews the certificate file using the SAN list inside it, so
    // a name added by acme:issue is renewed by construction. Appending names to
    // that script made each one open another certificate file — and two files
    // sharing a CN meant one silently overwrote the other.
    const executable = shellScripts().map(s => code(s.body)).join('\n')

    expect(executable).not.toContain('renew-mail-cert.sh')
    expect(executable).not.toMatch(/sed -i .*acme:renew/)
  })
})

describe('the mail health check', () => {
  const src = fs.readFileSync(SOURCE, 'utf8')
  const start = src.indexOf("cat > /usr/local/sbin/mail-health-check <<'EOF'")
  const end = src.indexOf('\nEOF', start)
  const healthCheck = src.slice(start, end)

  it('fails when a restart leaves mail inactive', () => {
    expect(healthCheck).toContain('if ! systemctl is-active --quiet mail; then')
    expect(healthCheck).toContain('mail remained inactive after restart')
    expect(healthCheck).toContain('return 1')
  })

  it('rechecks a missing listener after restarting mail', () => {
    expect(healthCheck).toContain('required TCP port $port is still not listening after restart')
    expect(healthCheck).toContain('exit 1')
  })
})
