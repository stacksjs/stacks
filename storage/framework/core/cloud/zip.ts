import { log, runCommand } from '@stacksjs/cli'

const result = await runCommand(
  'zip -r ./dist.zip dist/origin-request.js package.json',
  {
    cwd: import.meta.dir,
  },
)

if (result.isErr()) {
  log.error(result.error)
} else {
  // need to move the file to ../../cloud/dist.zip
  await runCommand('mv -f dist.zip ../../cloud/dist.zip', {
    cwd: import.meta.dir,
  })

  log.success('dist is zipped & moved')
}
