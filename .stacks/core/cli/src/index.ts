import ezSpawn from '@jsdevtools/ez-spawn'
import consola from 'consola'
import cac from 'cac'
import prompts from 'prompts'
import { ansi256Bg, bgBlack, bgBlue, bgCyan, bgGray, bgGreen, bgLightBlue, bgLightCyan, bgLightGray, bgLightGreen, bgLightMagenta, bgLightRed, bgLightYellow, bgMagenta, bgRed, bgWhite, bgYellow, black, blue, bold, cyan, dim, gray, green, hidden, inverse, italic, lightBlue, lightCyan, lightGray, lightGreen, lightMagenta, lightRed, lightYellow, link, magenta, red, reset, strikethrough, underline, white, yellow } from 'kolorist'
import ora from 'ora'
import { debugLevel } from '@stacksjs/config'
import type { CliOptions } from '@stacksjs/types'
import { projectPath } from '@stacksjs/path'

const spinner = ora
const Prompts = prompts
const command = cac
const spawn = ezSpawn

async function runCommand(command: string, options?: CliOptions) {
  const debug = debugLevel(options)

  if (options?.shortLived) {
    await spawn.async(command, { stdio: debug, cwd: options?.cwd || projectPath() })
    return
  }

  const spin = spinner('Running...').start()

  setTimeout(() => {
    spin.text = italic('This may take a little while...')
  }, 5000)

  await spawn.async(command, { stdio: debug, cwd: options?.cwd || projectPath() })

  spin.stop()
}

async function runShortLivedCommand(command: string, options?: CliOptions) {
  return await runCommand(command, { shortLived: true, ...options })
}

async function runLongRunningCommand(command: string, options?: CliOptions) {
  return await runCommand(command, { shortLived: false, ...options })
}

export {
  command, consola, cac,
  spawn, ezSpawn,
  prompts, Prompts,
  italic, reset, bold, dim, underline, inverse, hidden, strikethrough,
  black, red, green, yellow, blue, magenta, cyan, white, gray,
  lightGray, lightRed, lightGreen, lightYellow, lightBlue, lightMagenta, lightCyan,
  bgBlack, bgRed, bgGreen, bgYellow, bgBlue, bgMagenta, bgCyan, bgWhite, bgGray, bgLightRed, bgLightGreen, bgLightYellow, bgLightBlue, bgLightMagenta, bgLightCyan, bgLightGray,
  ansi256Bg, link,
  spinner, ora,
  runCommand, runLongRunningCommand, runShortLivedCommand,
}
