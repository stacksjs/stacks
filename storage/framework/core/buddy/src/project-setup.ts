import { FEATURE_NAMES } from '@stacksjs/features'

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
  // Machine-level commands: they list projects, find one, or talk to the
  // background daemon, from any directory. Requiring a project to ask which
  // projects there are made `buddy projects` unusable everywhere but inside one.
  'projects',
  'cd',
  'daemon',
  'dashboard',
  // Installing dependencies is what a fresh clone does before anything else,
  // and it reads no secret. Generating a key first wrote a `.env` into a
  // project that was only being installed.
  'install',
  // Apple signing/provisioning also serves standalone Stacks native apps.
  'desktop:apple',
  'build',
  'workflow',
  // Linking build dependencies changes no application data or secrets.
  'link:core',
  'unlink:core',
  // Changing framework packaging never initializes application secrets.
  'publish:core',
  'unpublish:core',
  'publish:defaults',
  'unpublish:defaults',
  'lint',
  'docs',
  'release',
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
  mode: { isHelpFlag?: boolean, isHelpMode?: boolean, args?: readonly string[] } = {},
): boolean {
  return Boolean(
    mode.isHelpFlag
    || mode.isHelpMode
    || (requestedCommand === 'support:install' && mode.args?.includes('--sdk-only'))
    // Enabling a feature changes project configuration, not application data.
    || FEATURE_NAMES.some(feature => requestedCommand === `${feature}:install` || requestedCommand === `${feature}:uninstall`)
    || APP_KEY_OPTIONAL_COMMANDS.some(command => requestedCommand === command || requestedCommand.startsWith(`${command}:`)),
  )
}
