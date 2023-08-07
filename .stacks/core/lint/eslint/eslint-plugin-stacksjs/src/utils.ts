import { ESLintUtils } from '@typescript-eslint/utils'

// import {  } from '@typescript-eslint/utils/dist/ts-eslint/Rule'

export const createEslintRule = ESLintUtils.RuleCreator(
  ruleName => ruleName,
)
