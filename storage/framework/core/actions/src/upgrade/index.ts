import process from 'node:process'
import type { UpgradeOptions } from '@stacksjs/types'
import { parseOptions } from '@stacksjs/cli'
import { ExitCode } from '@stacksjs/types'
import { runUpgrade } from './run'

const options = parseOptions() as UpgradeOptions
const result = await runUpgrade(options)
process.exit(result.isErr ? ExitCode.FatalError : ExitCode.Success)
