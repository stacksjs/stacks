import { runCommand } from '../cli/src/run'

const command: string = 'bun build ./src/index.ts --outdir dist --format esm'
const result = await runCommand(command, import.meta.dir)

if (result.isErr())
  console.error(result.error)
else
  // eslint-disable-next-line no-console
  console.log('Build complete')

// alternatively, the equivalent of the above using bun directly
// const cmd: string[] = command.split(' ')
// const proc = Bun.spawn(cmd, {
//   stdout: 'inherit',
//   cwd: import.meta.dir,
//   onExit(subprocess, exitCode, signalCode, error) {
//     if (exitCode !== 0 && exitCode) {
//       console.error(error)
//       process.exit(exitCode)
//     }
//   },
// })
//
// const exited = await proc.exited

// if (exited === 0)
//   console.log('Build complete')
// else
//   console.log(`Failed to execute command: ${cmd.join(' ')}`, proc.exited)
