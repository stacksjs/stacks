const APP_KEY_OPTIONAL_COMMANDS = [
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
