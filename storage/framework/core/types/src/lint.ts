/**
 * **Lint Options**
 *
 * Configuration for the checks Stacks runs on top of code style. Code style
 * itself lives in `config/code-style.ts`, which is pickier's own options
 * object; this covers what `buddy lint` adds around it.
 */
export interface LintConfig {
  /**
   * **stx conformance**
   *
   * Chapter 12 of the stx standards, run by `buddy lint --stx`.
   */
  stx?: StxLintOptions
}

export interface StxLintOptions {
  /**
   * **Templates to check**
   *
   * Glob relative to the project root. Defaults to `resources/**\/*.stx`.
   */
  stxGlob?: string

  /**
   * **Built HTML to check**
   *
   * Glob relative to the project root. Defaults to `dist/**\/*.html`.
   *
   * Three checks read the build output rather than the sources, because a
   * mis-resolved component can put an error string on every built page while
   * the build still exits 0 - something no amount of reading `.stx` catches.
   */
  distGlob?: string

  /**
   * **Accepted counts, per check**
   *
   * A ratchet. A number here is a DEBT, not a target: a count above its
   * baseline fails, and one below it is reported too, so clearing a violation
   * has to be recorded rather than quietly banked. A check with no entry is
   * held at zero, so a check added by a framework upgrade starts strict.
   */
  baselines?: Record<string, number>

  /**
   * **Paths exempt from the `<!DOCTYPE>` rule**
   *
   * Prefixes, matched against the project-relative path.
   */
  doctypeExempt?: string[]

  /**
   * **Paths exempt from the styling and link rules**
   *
   * Defaults to `resources/emails/`, and not as a concession: an email client
   * strips `<style>` and has no router, so inline `style=""` and absolute
   * `<a href>` are the only things that work there.
   */
  styleExempt?: string[]

  /**
   * **Strict-lint rules to switch off**
   *
   * For rules that are stale against the installed stx and produce false
   * positives. Record which version you verified against - an entry here
   * silences a real finding just as easily as a false one.
   */
  staleRules?: Record<string, boolean>
}
