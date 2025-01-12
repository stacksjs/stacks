import * as c from './case'
import p from './pluralize'
import * as u from './utils'

export const Str = {
  slash(str: string): string {
    return u.slash(str)
  },

  ensurePrefix(prefix: string, str: string): string {
    return u.ensurePrefix(prefix, str)
  },

  ensureSuffix(suffix: string, str: string): string {
    return u.ensureSuffix(suffix, str)
  },

  template(str: string, ...args: any[]): string {
    return u.template(str, ...args)
  },

  /**
   * Truncate a string
   */
  truncate(str: string, length: number, end = '...'): string {
    return u.truncate(str, length, end)
  },

  random(length = 16, dict?: string): string {
    return u.random(length, dict)
  },

  capitalize(str: string): string {
    return c.capitalize(str)
  },

  slug(str: string): string {
    return u.slug(str)
  },

  detectIndent(str: string): {
    amount: number
    indent: string
    type?: string | undefined
  } {
    return u.detectIndent(str)
  },

  detectNewline(str: string): string | undefined {
    return u.detectNewline(str)
  },

  camelCase(str: string): string {
    return c.camelCase(str)
  },

  capitalCase(str: string): string {
    return c.capitalCase(str)
  },

  constantCase(str: string): string {
    return c.constantCase(str)
  },

  dotCase(str: string): string {
    return c.dotCase(str)
  },

  noCase(str: string): string {
    return c.noCase(str)
  },

  paramCase(str: string): string {
    return c.paramCase(str)
  },

  pascalCase(str: string): string {
    return c.pascalCase(str)
  },

  pathCase(str: string): string {
    return c.pathCase(str)
  },

  sentenceCase(str: string): string {
    return c.sentenceCase(str)
  },

  snakeCase(str: string): string {
    return c.snakeCase(str)
  },

  titleCase(str: string): string {
    return c.titleCase(str)
  },

  kebabCase(str: string): string {
    return c.kebabCase(str)
  },

  plural(str: string): string {
    // plural, singular, isPlural, isSingular, addPluralRule, addSingularRule, addIrregularRule, addUncountableRule
    return p.plural(str)
  },

  singular(str: string): string {
    return p.singular(str)
  },

  isPlural(str: string): boolean {
    return p.isPlural(str)
  },

  isSingular(str: string): boolean {
    return p.isSingular(str)
  },

  addPluralRule(rule: string | RegExp, repl: string): void {
    p.addPluralRule(rule, repl)
  },

  addSingularRule(rule: string | RegExp, repl: string): void {
    p.addSingularRule(rule, repl)
  },

  addIrregularRule(single: string, plural: string): void {
    p.addIrregularRule(single, plural)
  },

  addUncountableRule(word: string | RegExp): void {
    p.addUncountableRule(word)
  },
}

export const str: typeof Str = Str
