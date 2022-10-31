import ezSpawn from '@jsdevtools/ez-spawn'
import consola from 'consola'
import cac from 'cac'
import prompts from 'prompts'
import { ansi256Bg, bgBlack, bgBlue, bgCyan, bgGray, bgGreen, bgLightBlue, bgLightCyan, bgLightGray, bgLightGreen, bgLightMagenta, bgLightRed, bgLightYellow, bgMagenta, bgRed, bgWhite, bgYellow, black, blue, bold, cyan, dim, gray, green, hidden, inverse, italic, lightBlue, lightCyan, lightGray, lightGreen, lightMagenta, lightRed, lightYellow, link, magenta, red, reset, strikethrough, underline, white, yellow } from 'kolorist'

const spawn = ezSpawn
const Prompts = prompts

const command = cac

export {
  command, consola, cac,
  spawn, ezSpawn,
  prompts, Prompts,
  italic, reset, bold, dim, underline, inverse, hidden, strikethrough,
  black, red, green, yellow, blue, magenta, cyan, white, gray,
  lightGray, lightRed, lightGreen, lightYellow, lightBlue, lightMagenta, lightCyan,
  bgBlack, bgRed, bgGreen, bgYellow, bgBlue, bgMagenta, bgCyan, bgWhite, bgGray, bgLightRed, bgLightGreen, bgLightYellow, bgLightBlue, bgLightMagenta, bgLightCyan, bgLightGray,
  ansi256Bg, link,
}
