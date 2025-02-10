import { Action } from '@stacksjs/actions'

/**
 * CLI Setup
 */

export default new Action({
  name: 'CLI Setup',
  description: 'This action is used to setup the CLI.',
  path: '/install',

  handle(): string {
    const setupScriptContents = `if [ -n "$1" ]; then
  # Check if the directory exists
  if [ -d "storage/framework/core" ]; then # this is our identifier whether it is a Stacks project
    :
  else
    if [ -d "$1" ]; then
      echo "Project $1 exists locally. Please use a different name & run again."
      exit 1
    else
      git clone https://github.com/stacksjs/stacks.git $1
      cd $1
      # Run the pkgx-install script
      "./storage/framework/scripts/pkgx-install"

      echo "Project $1 has been created. Please open a new terminal, run 'bun run dev' to start the server."

      exit 1
    fi
  fi
fi

# Get the directory of the current script and go up 3 directories
PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
CLI_PATH="$PROJECT_ROOT/storage/framework/core/buddy/src/cli.ts"
SCRIPT_PATH="$PROJECT_ROOT/storage/framework/scripts/pkgx-install"
LOG_PATH="$PROJECT_ROOT/storage/logs/console.log"

if [[ $* == *--verbose* ]]; then
  echo "Project root: $PROJECT_ROOT"
  echo "CLI path: $CLI_PATH"
  echo "Script path: $SCRIPT_PATH"
  echo "Log path: $LOG_PATH"
fi

cd $PROJECT_ROOT
# Run the pkgx-install script
if [[ $* == *--verbose* ]]; then
  "$SCRIPT_PATH"
  # bun ./storage/framework/core/buddy/src/cli.ts setup --verbose
else
  "$SCRIPT_PATH" > /dev/null 2>&1
  # bun ./storage/framework/core/buddy/src/cli.ts setup
fi

# Create a named pipe
mkfifo /tmp/mypipe

# Run the command, send output to both the console and the pipe
bun $CLI_PATH setup | tee /tmp/mypipe &

# Read from the pipe, add timestamps, and append to the file
while IFS= read -r line; do echo "$(date '+[%Y-%m-%d %H:%M:%S]') $line"; done < /tmp/mypipe >> $LOG_PATH

# Remove the named pipe
rm /tmp/mypipe
`

    return setupScriptContents
  },
})
