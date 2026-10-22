/**
 * System dependencies a project declares that the registry cannot install.
 *
 * Apps scaffolded before July 2026 carry `craft: '^0.0.1'` in their own
 * `config/deps.ts`. Pantry resolves it to `craft-native.org`, which has no
 * artifacts at all, so once a pantry release stopped skipping it every
 * `./buddy` bootstrap failed at install, and an app stopped deploying for three
 * days with no other symptom (stacksjs/stacks#2919). The framework's own copy
 * dropped it long ago, but a scaffolded app keeps the file it was given.
 *
 * Craft is the native desktop shell. A web or mobile build never runs its
 * binary, and the SDK comes from `craft-native` in package.json.
 */
export function describeSystemDependencies(depsSource: string): { status: 'pass' | 'fail', message: string } {
  // Comments stripped first, so the commented-out examples a deps file
  // carries are not read as declarations.
  const code = new Bun.Transpiler({ loader: 'ts', trimUnusedImports: false }).transformSync(depsSource)
  if (/(?:^|[{,\s])["']?craft["']?\s*:/m.test(code)) {
    return {
      status: 'fail',
      message: 'config/deps.ts declares `craft`, which Pantry resolves to craft-native.org, a package the registry has no artifacts for, so `pantry install` fails. Remove the line: the Craft SDK comes from `craft-native` in package.json, and a desktop build installs the CLI with `pantry install craft`.',
    }
  }
  return { status: 'pass', message: 'config/deps.ts declares no system dependency the registry cannot install' }
}
