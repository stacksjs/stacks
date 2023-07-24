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

export const plural: Pluralize['plural'] = pluralize.plural
export const singular: Pluralize['singular'] = pluralize.singular
export const isPlural: Pluralize['isPlural'] = pluralize.isPlural
export const isSingular: Pluralize['isSingular'] = pluralize.isSingular
export const addPluralRule: Pluralize['addPluralRule'] = pluralize.addPluralRule
export const addSingularRule: Pluralize['addSingularRule'] = pluralize.addSingularRule
export const addIrregularRule: Pluralize['addIrregularRule'] = pluralize.addIrregularRule
export const addUncountableRule: Pluralize['addUncountableRule'] = pluralize.addUncountableRule
