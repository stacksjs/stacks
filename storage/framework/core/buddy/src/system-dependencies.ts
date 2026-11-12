/**
 * A migration check for the obsolete Craft constraint in July 2026 scaffolds
 * (stacksjs/stacks#2919), not a second Pantry package/range resolver.
 *
 * `craft` aliases to `craft-native.org`, which now publishes native artifacts.
 * The old `^0.0.1` only accepts that patch line, not later native releases.
 * Pantry remains responsible for resolving other ranges and host artifacts.
 */
export function describeSystemDependencies(depsSource: string): { status: 'pass' | 'fail', message: string } {
  // Transpile away comments/types, then keep string literals whole. A quoted
  // example of an object is data, not a dependency declaration. Preserve
  // brackets too: [craft] is not a literal package key.
  const code = new Bun.Transpiler({ loader: 'ts', trimUnusedImports: false }).transformSync(depsSource)
  const tokens = code.match(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|[\w$]+|[^\s]/g) ?? []
  const tokenValue = (token: string | undefined): string | undefined => token && /^["'`]/.test(token) ? token.slice(1, -1) : token
  const dependencyBlocks: boolean[] = []

  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index]
    if (token === '{') {
      dependencyBlocks.push(dependencyBlocks.at(-1) === true
        || (tokens[index - 1] === ':' && tokenValue(tokens[index - 2]) === 'dependencies'))
    }
    else if (token === '}') {
      dependencyBlocks.pop()
    }
    else if (dependencyBlocks.at(-1)
      && (tokens[index - 1] === '{' || tokens[index - 1] === ',')
      && (tokenValue(token) === 'craft' || tokenValue(token) === 'craft-native.org')
      && tokens[index + 1] === ':'
      && /^["'`]/.test(tokens[index + 2] ?? '')
      && tokenValue(tokens[index + 2])?.trim() === '^0.0.1'
      && (tokens[index + 3] === ',' || tokens[index + 3] === '}')) {
      return {
        status: 'fail',
        message: 'config/deps.ts declares the obsolete Craft scaffold range `^0.0.1`. The `craft` alias resolves to craft-native.org, but this range only accepts that patch line, not its later published native releases. Remove the line if only the `craft-native` SDK in package.json is needed. For a native CLI dependency, declare the qualified native range for the target platform and use Pantry to install that declared range.',
      }
    }
  }

  return { status: 'pass', message: 'No direct literal obsolete Craft `^0.0.1` scaffold declaration found in dependency objects; Pantry validates other package ranges and host artifacts during installation' }
}
