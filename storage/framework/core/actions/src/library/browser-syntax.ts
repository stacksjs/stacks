import type { Node } from '@babel/types'
import { parse } from '@babel/parser'
import { isIdentifier, isMemberExpression, isMetaProperty, isOptionalMemberExpression, isStringLiteral, isTemplateLiteral, traverse } from '@babel/types'

/** Inspect executable syntax, never string, comment, regex or template text. */
export function readsEnvironment(contents: string, path: string): boolean {
  const source = parse(contents, { sourceType: 'module', sourceFilename: path, plugins: /\.[jt]sx$/.test(path) ? ['typescript', 'jsx'] : ['typescript'] })
  let found = false
  const property = (node: Node | undefined) => {
    if (!node || (!isMemberExpression(node) && !isOptionalMemberExpression(node))) return
    const name = !node.computed && isIdentifier(node.property) ? node.property.name
      : isStringLiteral(node.property) ? node.property.value
        : isTemplateLiteral(node.property) && !node.property.expressions.length ? node.property.quasis[0]?.value.cooked : undefined
    return { target: node.object, name }
  }
  traverse(source, (node, ancestors) => {
    const access = property(node)
    if (access?.name !== 'env') return
    const target = access.target
    const outer = property(target)
    const global = isIdentifier(target) && ['process', 'Bun'].includes(target.name)
      || outer && ['process', 'Bun'].includes(outer.name ?? '') && isIdentifier(outer.target) && ['globalThis', 'window', 'global'].includes(outer.target.name)
    const meta = isMetaProperty(target) && target.meta.name === 'import' && target.property.name === 'meta'
    const parent = property(ancestors.at(-1)?.node)
    // Bun's browser compiler supplies this conventional production constant.
    const nodeEnv = isIdentifier(target) && target.name === 'process' && parent?.target === node && parent.name === 'NODE_ENV'
    if ((global || meta) && !nodeEnv) found = true
  })
  return found
}
