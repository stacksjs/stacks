const APP_KEY_OPTIONAL_COMMANDS = [
  /*
   * `env:*` reads and writes an encrypted `.env` file and touches nothing else.
   *
   * It needs no application key — it *is* how a key gets set — and no
   * scaffolded project: encryption is useful in any repository that has
   * credentials to keep, which is what a standalone `bunx @stacksjs/buddy
   * env:get` is for. Requiring a Stacks app to decrypt a value made buddy
   * unusable as the env CLI for every project that is not one, and each of them
   * then wrote its own wrapper around the same `@stacksjs/env` functions.
   */
  'env',
  'build',
  'lint',
  'lint:fix',
  'test',
  'test:types',
  'test:unit',
  'test:feature',
  'typecheck',
  'types:fix',
  'types:generate',
  'clean',
  'fresh',
  'about',
  'ai:context',
  'doctor',
  'list',
  'setup',
  'setup:ssl',
  'setup:oh-my-zsh',
  'deploy',
  'serve',
  'new',
  'create',
  'upgrade',
  'update',
  'migrate',
  'seed',
  'generate',
  'make',
  'key:generate',
  'scaffold:crud',
]

export function shouldSkipAppKeyCheck(
  requestedCommand: string,
  mode: { isHelpFlag?: boolean, isHelpMode?: boolean } = {},
): boolean {
  return Boolean(
    mode.isHelpFlag
    || mode.isHelpMode
    || APP_KEY_OPTIONAL_COMMANDS.some(command => requestedCommand === command || requestedCommand.startsWith(`${command}:`)),
  )
}
