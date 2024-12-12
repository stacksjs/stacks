import { log, runCommand } from '@stacksjs/cli'
// generates the pkgx file based on the user configuration
import { config } from '@stacksjs/config'

// @ts-expect-error - no types
import data from '../../../../../pkgx.yaml'

if (!data)
  throw new Error('pkgx.yaml file not found')

if (data.dependencies['aws.amazon.com/cdk'] === undefined) {
  log.info('aws.amazon.com/cdk dependency not found in pkgx.yaml.')
  // throw an error unless its installed locally
  const result = await runCommand('which cdk')
  if (result.isErr())
    throw new Error('aws.amazon.com/cdk dependency not found in pkgx.yaml. To confirm, run `which cdk`')
}

if (data.dependencies['aws.amazon.com/cli'] === undefined) {
  log.info('aws.amazon.com/cli dependency not found in pkgx.yaml.')
  const result = await runCommand('which aws')
  if (result.isErr())
    throw new Error('aws.amazon.com/cli dependency not found in pkgx.yaml. To confirm, run `which aws`')
}

if (data.dependencies['bun.sh'] === undefined) {
  log.info('bun.sh dependency not found in pkgx.yaml.')
  // throw an error unless its installed locally
  const result = await runCommand('which aws')
  if (result.isErr())
    throw new Error('bun.sh dependency not found in pkgx.yaml. To confirm, run `which bun`')
}

if (data.dependencies['info-zip.org/zip'] === undefined) {
  log.info('info-zip.org/zip dependency not found in pkgx.yaml.')
  // throw an error unless its installed locally
  const result = await runCommand('which zip')
  if (result.isErr())
    throw new Error('info-zip.org/zip dependency not found in pkgx.yaml. To confirm, run `which zip`')
}

if (data.dependencies['info-zip.org/unzip'] === undefined) {
  log.info('info-zip.org/unzip dependency not found in pkgx.yaml.')
  // throw an error unless its installed locally
  const result = await runCommand('which unzip')
  if (result.isErr())
    throw new Error('info-zip.org/unzip dependency not found in pkgx.yaml. To confirm, run `which unzip`')
}

if (data.dependencies['mailpit.axllent.org'] === undefined) {
  log.info('mailpit.axllent.org dependency not found in pkgx.yaml.')
  // throw an error unless its installed locally
  const result = await runCommand('which mailpit')
  if (result.isErr())
    throw new Error('mailpit.axllent.org dependency not found in pkgx.yaml. To confirm, run `which mailpit`')
}

if (data.dependencies['redis.io'] === undefined) {
  log.info('redis.io dependency not found in pkgx.yaml.')
  // throw an error unless its installed locally
  const result = await runCommand('which redis')
  if (result.isErr())
    throw new Error('redis.io dependency not found in pkgx.yaml. To confirm, run `which redis`')
}

if (config.database.default === 'sqlite' && data.dependencies['sqlite.org'] === undefined) {
  log.info('sqlite.org dependency not found in pkgx.yaml.')
  // throw an error unless its installed locally
  const result = await runCommand('which sqlite')
  if (result.isErr())
    throw new Error('sqlite.org dependency not found in pkgx.yaml. To confirm, run `which sqlite`')
}
