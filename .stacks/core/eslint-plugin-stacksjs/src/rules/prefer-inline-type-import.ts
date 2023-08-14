/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */

// Ported from https://github.com/gajus/eslint-plugin-canonical/blob/master/src/rules/preferInlineTypeImport.js
// by Gajus Kuizinas https://github.com/gajus
import { createEslintRule } from '../utils'

const removeTypeSpecifier = function* (fixer: any, sourceCode: any, node: any) {
  const importKeyword = sourceCode.getFirstToken(node)

  const typeIdentifier = sourceCode.getTokenAfter(importKeyword)

  yield fixer.remove(typeIdentifier)

  if (importKeyword.loc.end.column + 1 === typeIdentifier.loc.start.column) {
    yield fixer.removeRange([
      importKeyword.range[1],
      importKeyword.range[1] + 1,
    ])
  }
}

type Options = []

type MessageIds = 'noTypeImport'

export default createEslintRule<Options, MessageIds>({
  create: (context) => {
    const sourceCode = context.getSourceCode()
    return {
      ImportDeclaration: (node) => {
        if (node.importKind !== 'type')
          return

        // import type Foo from 'foo';
        if (node.specifiers[0]?.type === 'ImportDefaultSpecifier')
          return

        // import type * as Foo from 'foo';
        if (node.specifiers[0]?.type === 'ImportNamespaceSpecifier')
          return

        context.report({
          *fix(fixer) {
            yield * removeTypeSpecifier(fixer, sourceCode, node)

            for (const specifier of node.specifiers)
              yield fixer.insertTextBefore(specifier, 'type ')
          },
          loc: node.loc,
          messageId: 'noTypeImport',
          node,
        })
      },
    }
  },
  defaultOptions: [],
  meta: {
    docs: {
      description: '',
      recommended: 'recommended',
    },
    fixable: 'code',
    messages: {
      noTypeImport: 'Type imports must be inlined',
    },
    schema: [],
    type: 'suggestion',
  },
  name: 'prefer-inline-type-imports',
})
