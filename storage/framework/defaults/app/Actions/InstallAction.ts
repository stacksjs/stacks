import process from 'node:process'
import { Action } from '@stacksjs/actions/runtime'

/**
 * CLI Setup
 */

export default new Action({
  name: 'CLI Setup',
  description: 'This action is used to setup the CLI.',
  path: '/install',

  handle(): string | Response {
    // Production short-circuits to 404 so even an accidental or userland
    // re-registration can't serve the framework's shell bootstrap script
    // (free stack fingerprinting) in prod — same defense-in-depth layer as
    // TestErrorAction's guard (#1955). Production-only (not the
    // registration gate's local-env allowlist) so a deliberate
    // re-registration in staging still works.
    const env = (process.env.APP_ENV ?? process.env.NODE_ENV ?? '').toLowerCase()
    if (env === 'production')
      return new Response('Not Found', { status: 404 })

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
      # Run the pantry-install script
      "./storage/framework/scripts/pantry-install" || exit $?

      echo "Project $1 has been created. Please open a new terminal, run 'bun run dev' to start the server."

      exit 1
    fi
  fi
fi

# Get the directory of the current script and go up 3 directories
PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
CLI_PATH="$PROJECT_ROOT/storage/framework/core/buddy/src/cli.ts"
SCRIPT_PATH="$PROJECT_ROOT/storage/framework/scripts/pantry-install"
LOG_PATH="$PROJECT_ROOT/storage/logs/console.log"

if [[ $* == *--verbose* ]]; then
  echo "Project root: $PROJECT_ROOT"
  echo "CLI path: $CLI_PATH"
  echo "Script path: $SCRIPT_PATH"
  echo "Log path: $LOG_PATH"
fi

cd $PROJECT_ROOT
# Run the pantry-install script
if [[ $* == *--verbose* ]]; then
  "$SCRIPT_PATH" || exit $?
  # bun ./storage/framework/core/buddy/src/cli.ts setup --verbose
else
  "$SCRIPT_PATH" > /dev/null || exit $?
  # bun ./storage/framework/core/buddy/src/cli.ts setup
fi

# Each run owns a private directory for its named pipe, so two runs never read
# or delete each other's stream, and nothing outlives this one. The directory is
# removed on success, on failure and when the run is interrupted.
PIPE_DIR="$(mktemp -d "\${TMPDIR:-/tmp}/stacks-install.XXXXXX")" || exit 1
PIPE="$PIPE_DIR/setup.pipe"
SETUP_PID=""
cleanup() {
  if [ -n "$SETUP_PID" ]; then kill -TERM -- "-$SETUP_PID" 2>/dev/null; fi
  rm -rf "$PIPE_DIR"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM HUP

mkfifo "$PIPE" || exit 1

# Run the command, send output to both the console and the pipe. It gets its own
# process group (job control) so an interrupted run can stop all of it, and
# pipefail keeps the setup's own exit status rather than tee's.
set -m
( set -o pipefail; bun "$CLI_PATH" setup | tee "$PIPE" ) &
SETUP_PID=$!
set +m

# Read from the pipe, add timestamps, and append to the file
while IFS= read -r line; do echo "$(date '+[%Y-%m-%d %H:%M:%S]') $line"; done < "$PIPE" >> "$LOG_PATH"

# Report the setup's exit status, not the cleanup's
wait "$SETUP_PID"
STATUS=$?
SETUP_PID=""
exit "$STATUS"
`

    return setupScriptContents
  },
})
