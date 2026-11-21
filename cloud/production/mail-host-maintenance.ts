#!/usr/local/bin/bun --no-env-file
import process from 'node:process'

const operator = Bun.spawn(['/usr/local/sbin/stacks-host-ops', 'mail-host-maintenance', ...process.argv.slice(2)], {
  stdin: 'inherit',
  stdout: 'inherit',
  stderr: 'inherit',
})
process.exitCode = await operator.exited
