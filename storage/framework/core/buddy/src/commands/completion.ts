import type { CLI } from '@stacksjs/types'
import process from 'node:process'
import { log } from '@stacksjs/cli'

export function completion(buddy: CLI): void {
  const descriptions = {
    completion: 'Generate shell completion scripts',
    shell: 'Shell type (bash, zsh, fish)',
  }

  buddy
    .command('completion [shell]', descriptions.completion)
    .option('-s, --shell [shell]', descriptions.shell)
    .example('buddy completion bash')
    .example('buddy completion zsh')
    .example('buddy completion fish')
    .example('buddy completion bash > /usr/local/etc/bash_completion.d/buddy')
    .action(async (shell: string, options: any) => {
      log.debug('Running `buddy completion` ...', options)

      const targetShell = shell || options.shell || 'bash'

      // Get all commands from buddy
      const commands = buddy.commands || []
      const commandNames = commands.map((cmd: any) => cmd.name).filter(Boolean)

      switch (targetShell) {
        case 'bash':
          console.log(generateBashCompletion(commandNames))
          break
        case 'zsh':
          console.log(generateZshCompletion(commandNames))
          break
        case 'fish':
          console.log(generateFishCompletion(commandNames))
          break
        default:
          console.error(`Unknown shell: ${targetShell}`)
          console.error('Supported shells: bash, zsh, fish')
          process.exit(1)
      }
    })

  buddy.on('completion:*', () => {
    console.error('Invalid command: %s\nSee --help for a list of available commands.', buddy.args.join(' '))
    process.exit(1)
  })
}

function generateBashCompletion(commands: string[]): string {
  return `# buddy completion for bash

_buddy_completion() {
    local cur prev commands
    COMPREPLY=()
    cur="\${COMP_WORDS[COMP_CWORD]}"
    prev="\${COMP_WORDS[COMP_CWORD-1]}"

    commands="${commands.join(' ')}"

    # Complete command names
    if [ $COMP_CWORD -eq 1 ]; then
        COMPREPLY=( $(compgen -W "$commands" -- "$cur") )
        return 0
    fi

    # Complete global flags
    case "$prev" in
        buddy|*)
            COMPREPLY=( $(compgen -W "--help --version --verbose --quiet --debug --no-interaction --env --dry-run --force" -- "$cur") )
            return 0
            ;;
    esac
}

complete -F _buddy_completion buddy

# Installation:
# To install this completion script, save it to:
# - Linux: /etc/bash_completion.d/buddy or ~/.bash_completion
# - macOS: /usr/local/etc/bash_completion.d/buddy
#
# Then reload your shell or run: source ~/.bashrc
`
}

function generateZshCompletion(commands: string[]): string {
  const commandList = commands.map(cmd => `    '${cmd}:${cmd} command'`).join('\n')

  return `#compdef buddy

# buddy completion for zsh

_buddy() {
    local -a commands
    commands=(
${commandList}
    )

    local -a global_flags
    global_flags=(
        '--help[Display help message]'
        '--version[Display version number]'
        '--verbose[Enable verbose output]'
        '--quiet[Suppress non-essential output]'
        '--debug[Enable debug mode]'
        '--no-interaction[Do not ask interactive questions]'
        '--env[Target environment]:environment:'
        '--dry-run[Preview actions without executing]'
        '--force[Skip confirmation prompts]'
    )

    _arguments -C \\
        '1: :->command' \\
        '*::arg:->args' \\
        $global_flags

    case $state in
        command)
            _describe 'buddy command' commands
            ;;
        *)
            # Add subcommand-specific completions here if needed
            ;;
    esac
}

_buddy "$@"

# Installation:
# Save this file to a directory in your $fpath, for example:
# ~/.zsh/completions/_buddy
#
# Then add to your ~/.zshrc:
# fpath=(~/.zsh/completions $fpath)
# autoload -Uz compinit && compinit
`
}

function generateFishCompletion(commands: string[]): string {
  const commandCompletions = commands.map(cmd =>
    `complete -c buddy -n "__fish_use_subcommand" -a "${cmd}" -d "${cmd} command"`
  ).join('\n')

  return `# buddy completion for fish

# Remove old completions
complete -c buddy -e

# Command completions
${commandCompletions}

# Global flag completions
complete -c buddy -l help -d "Display help message"
complete -c buddy -l version -d "Display version number"
complete -c buddy -s v -l verbose -d "Enable verbose output"
complete -c buddy -s q -l quiet -d "Suppress non-essential output"
complete -c buddy -l debug -d "Enable debug mode"
complete -c buddy -s n -l no-interaction -d "Do not ask interactive questions"
complete -c buddy -l env -d "Target environment" -r
complete -c buddy -l dry-run -d "Preview actions without executing"
complete -c buddy -s f -l force -d "Skip confirmation prompts"

# Installation:
# Save this file to:
# ~/.config/fish/completions/buddy.fish
#
# Fish will automatically load it on startup
`
}
