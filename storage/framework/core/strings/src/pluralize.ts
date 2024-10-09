import * as pluralize from 'pluralize'

type Rule = string | RegExp
type Replacement = string
type Word = string
export type PluralizeTest = (word: Word) => boolean

export interface Pluralize {
  plural: (word: Word, count?: number, inclusive?: boolean) => Word
  singular: (word: Word) => Word
  isPlural: (word: Word) => boolean
  isSingular: (word: Word) => boolean
  addPluralRule: (rule: Rule, replacement: Replacement) => void
  addSingularRule: (rule: Rule, replacement: Replacement) => void
  addIrregularRule: (single: Word, plural: Word) => void
  addUncountableRule: (word: Word | RegExp) => void
}

export const plural: Pluralize['plural'] = (word, count, inclusive) => {
  if (count !== undefined && inclusive)
    return `${count} ${pluralize.plural(word)}`

  return pluralize.plural(word)
}

export const singular: Pluralize['singular'] = word => pluralize.singular(word)
export const isPlural: Pluralize['isPlural'] = word => pluralize.isPlural(word)
export const isSingular: Pluralize['isSingular'] = word => pluralize.isSingular(word)
export const addPluralRule: Pluralize['addPluralRule'] = (rule, replacement) =>
  pluralize.addPluralRule(rule, replacement)
export const addSingularRule: Pluralize['addSingularRule'] = (rule, replacement) =>
  pluralize.addSingularRule(rule, replacement)
export const addIrregularRule: Pluralize['addIrregularRule'] = (single, plural) =>
  pluralize.addIrregularRule(single, plural)
export const addUncountableRule: Pluralize['addUncountableRule'] = word => pluralize.addUncountableRule(word)
