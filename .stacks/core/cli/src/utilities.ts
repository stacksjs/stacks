export function parseArgs(args?: string[]) {
  if (!args) args = process.argv.slice(2)

  // parse the args into an object
  return args.reduce((acc, arg) => {
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=')
      acc[key] = value === 'false' ? false : true
    }
    return acc
  }, {} as Record<string, boolean>)
}

export { ansi256Bg, bgBlack, bgBlue, bgCyan, bgGray, bgGreen, bgLightBlue, bgLightCyan, bgLightGray, bgLightGreen, bgLightMagenta, bgLightRed, bgLightYellow, bgMagenta, bgRed, bgWhite, bgYellow, black, blue, bold, cyan, dim, gray, green, hidden, inverse, italic, lightBlue, lightCyan, lightGray, lightGreen, lightMagenta, lightRed, lightYellow, link, magenta, red, reset, strikethrough, underline, white, yellow } from 'kolorist'
