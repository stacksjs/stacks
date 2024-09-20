import * as c from './case'
import * as p from './pluralize'
import * as u from './utils'

export const Str = {
  slash(str: string) {
    return u.slash(str)
  },

  ensurePrefix(prefix: string, str: string) {
    return u.ensurePrefix(prefix, str)
  },

  ensureSuffix(suffix: string, str: string) {
    return u.ensureSuffix(suffix, str)
  },

  template(str: string, ...args: any[]): string {
    return u.template(str, ...args)
  },

  /**
   * Truncate a string
   */
  truncate(str: string, length: number, end = '...') {
    return u.truncate(str, length, end)
  },

  random(length = 16, dict?: string) {
    return u.random(length, dict)
  },

  capitalize(str: string) {
    return c.capitalize(str)
  },

  slug(str: string) {
    return u.slug(str)
  },

  detectIndent(str: string) {
    return u.detectIndent(str)
  },

  detectNewline(str: string) {
    return u.detectNewline(str)
  },

  camelCase(str: string) {
    return c.camelCase(str)
  },

  capitalCase(str: string) {
    return c.capitalCase(str)
  },

  constantCase(str: string) {
    return c.constantCase(str)
  },

  dotCase(str: string) {
    return c.dotCase(str)
  },

  noCase(str: string) {
    return c.noCase(str)
  },

  paramCase(str: string) {
    return c.paramCase(str)
  },

  pascalCase(str: string) {
    return c.pascalCase(str)
  },

  pathCase(str: string) {
    return c.pathCase(str)
  },

  sentenceCase(str: string) {
    return c.sentenceCase(str)
  },

  snakeCase(str: string) {
    return c.snakeCase(str)
  },

  titleCase(str: string) {
    return c.titleCase(str)
  },

  kebabCase(str: string) {
    return c.kebabCase(str)
  },

  plural(str: string) {
    // plural, singular, isPlural, isSingular, addPluralRule, addSingularRule, addIrregularRule, addUncountableRule
    return p.plural(str)
  },

  singular(str: string) {
    return p.singular(str)
  },

  isPlural(str: string) {
    return p.isPlural(str)
  },

  isSingular(str: string) {
    return p.isSingular(str)
  },

  addPluralRule(rule: string | RegExp, repl: string) {
    return p.addPluralRule(rule, repl)
  },

  addSingularRule(rule: string | RegExp, repl: string) {
    return p.addSingularRule(rule, repl)
  },

  addIrregularRule(single: string, plural: string) {
    return p.addIrregularRule(single, plural)
  },

  addUncountableRule(word: string | RegExp) {
    return p.addUncountableRule(word)
  },
}

export const str = Str
